"""
MeteoGlobe API server.
"""

from __future__ import annotations

import asyncio
import math
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel

load_dotenv()

def env_int(name: str, default: int) -> int:
    raw = os.getenv(name, str(default))
    try:
        return int(str(raw).strip())
    except (TypeError, ValueError):
        return default


TILE_URL_TEMPLATE = os.getenv("TILE_URL_TEMPLATE", "http://localhost:8081/tile/{z}/{x}/{y}.png")
TILE_UPSTREAM_URL_TEMPLATE = os.getenv("TILE_UPSTREAM_URL_TEMPLATE", TILE_URL_TEMPLATE)
TILE_ATTRIBUTION = os.getenv("TILE_ATTRIBUTION", "(c) OpenStreetMap contributors (self-hosted)")
TILE_MIN_LEVEL = env_int("TILE_MIN_LEVEL", 0)
TILE_OVERLAY_MIN_ZOOM = env_int("TILE_OVERLAY_MIN_ZOOM", 5)
TILE_BOUNDS = os.getenv("TILE_BOUNDS", "").strip()
PORT = env_int("PORT", 3000)

# key -> {"data": ..., "expires_at": ...}
_cache: dict[str, dict[str, Any]] = {}

# Local official icon cache.
_icon_cache: dict[int, tuple[bytes, str]] = {}
ICON_LOCAL_DIR = os.path.join("public", "icons")
SUPPORTED_ICON_CODES = set(range(1, 43)) | set(range(101, 143))

_http: httpx.AsyncClient | None = None


def cache_get(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry and time.time() < float(entry["expires_at"]):
        return entry["data"]
    return None


def cache_set(key: str, data: Any, ttl: int = 600) -> None:
    _cache[key] = {"data": data, "expires_at": time.time() + ttl}


def as_float(v: Any) -> float | None:
    try:
        if v is None:
            return None
        return float(v)
    except (TypeError, ValueError):
        return None


def as_int(v: Any) -> int | None:
    try:
        if v is None:
            return None
        return int(v)
    except (TypeError, ValueError):
        return None


def render_tile_url(template: str, z: int, x: int, y: int) -> str:
    max_index = (2**z) - 1
    reverse_y = max_index - y
    return (
        template.replace("{z}", str(z))
        .replace("{x}", str(x))
        .replace("{y}", str(y))
        .replace("{reverseY}", str(reverse_y))
        .replace("{s}", "a")
    )


def iso_utc_to_unix(ts: Any) -> int | None:
    if not isinstance(ts, str) or not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp())
    except Exception:
        return None


def open_meteo_code_to_owm(code: Any) -> int:
    c = as_int(code)
    if c is None:
        return 800
    if c == 0:
        return 800
    if c == 1:
        return 801
    if c == 2:
        return 802
    if c == 3:
        return 804
    if c in (45, 48):
        return 741
    if c in (51, 53, 55):
        return 300
    if c in (56, 57, 66, 67):
        return 511
    if c == 61:
        return 500
    if c == 63:
        return 501
    if c == 65:
        return 502
    if c == 71:
        return 600
    if c == 73:
        return 601
    if c in (75, 77):
        return 602
    if c == 80:
        return 520
    if c == 81:
        return 521
    if c == 82:
        return 522
    if c == 85:
        return 620
    if c == 86:
        return 622
    if c == 95:
        return 211
    if c in (96, 99):
        return 202
    return 800


def build_open_meteo_forecast(payload: dict[str, Any]) -> dict[str, Any]:
    hourly = payload.get("hourly") if isinstance(payload, dict) else None
    if not isinstance(hourly, dict):
        return {"list": [], "_source": "open-meteo"}

    times = hourly.get("time") if isinstance(hourly.get("time"), list) else []
    temps = hourly.get("temperature_2m") if isinstance(hourly.get("temperature_2m"), list) else []
    probs = hourly.get("precipitation_probability") if isinstance(hourly.get("precipitation_probability"), list) else []
    codes = hourly.get("weather_code") if isinstance(hourly.get("weather_code"), list) else []
    n = min(len(times), len(temps), len(probs), len(codes))
    if n == 0:
        return {"list": [], "_source": "open-meteo"}

    now_ts = int(time.time())
    out: list[dict[str, Any]] = []
    for i in range(n):
        if i % 3 != 0:
            continue
        dt_unix = iso_utc_to_unix(times[i])
        if dt_unix is None or dt_unix < now_ts - 3600:
            continue
        out.append(
            {
                "dt": dt_unix,
                "main": {"temp": temps[i]},
                "weather": [{"id": open_meteo_code_to_owm(codes[i]), "description": "forecast"}],
                "pop": max(0.0, min(1.0, (as_float(probs[i]) or 0.0) / 100.0)),
            }
        )
        if len(out) >= 16:
            break

    return {"list": out, "_source": "open-meteo"}


async def fetch_json(
    url: str,
    cache_key: str,
    ttl: int = 600,
    headers: dict[str, str] | None = None,
    params: dict[str, Any] | None = None,
    force: bool = False,
) -> Any:
    if not force:
        cached = cache_get(cache_key)
        if cached is not None:
            return cached

    assert _http is not None
    resp = await _http.get(url, params=params or {}, headers=headers or {})
    resp.raise_for_status()
    data = resp.json()
    cache_set(cache_key, data, ttl=ttl)
    return data


async def reverse_geocode_brief(lat: float, lon: float, force: bool = False) -> tuple[str, str]:
    key = f"revgeo_{lat:.3f}_{lon:.3f}"
    if not force:
        cached = cache_get(key)
        if isinstance(cached, dict):
            return str(cached.get("name") or "Selected location"), str(cached.get("country") or "")

    try:
        data = await fetch_json(
            "https://nominatim.openstreetmap.org/reverse",
            key,
            ttl=24 * 3600,
            headers={"User-Agent": "MeteoGlobe/1.0 (local app)"},
            params={"lat": lat, "lon": lon, "format": "jsonv2", "addressdetails": 1},
            force=force,
        )
        address = data.get("address") if isinstance(data, dict) else {}
        if not isinstance(address, dict):
            address = {}
        name = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("municipality")
            or address.get("county")
            or address.get("state")
            or str(data.get("name") or "").strip()
            or "Selected location"
        )
        country = str(address.get("country_code") or "").upper()
        return name, country
    except Exception:
        return "Selected location", ""


async def weather_payload(lat: float, lon: float, force: bool = False) -> dict[str, Any]:
    place_name, country_code = await reverse_geocode_brief(lat, lon, force=force)
    om_key = f"om_current_{lat:.4f}_{lon:.4f}"
    om_url = "https://api.open-meteo.com/v1/forecast"
    payload = await fetch_json(
        om_url,
        om_key,
        params={
            "latitude": lat,
            "longitude": lon,
            "current": (
                "temperature_2m,apparent_temperature,relative_humidity_2m,"
                "surface_pressure,wind_speed_10m,wind_direction_10m,weather_code,is_day"
            ),
            "timezone": "UTC",
        },
        force=force,
    )
    current = payload.get("current") if isinstance(payload, dict) else None
    if not isinstance(current, dict):
        raise HTTPException(status_code=500, detail="Open-Meteo current block missing")

    dt_unix = iso_utc_to_unix(current.get("time")) or int(time.time())
    temp = as_float(current.get("temperature_2m"))
    feels_like = as_float(current.get("apparent_temperature"))
    humidity = as_int(current.get("relative_humidity_2m"))
    pressure = as_float(current.get("surface_pressure"))
    wind_kmh = as_float(current.get("wind_speed_10m"))
    wind_deg = as_float(current.get("wind_direction_10m"))
    weather_code = open_meteo_code_to_owm(current.get("weather_code"))
    is_day = as_int(current.get("is_day"))

    sunrise = dt_unix - 6 * 3600 if is_day == 1 else dt_unix + 6 * 3600
    sunset = dt_unix + 6 * 3600 if is_day == 1 else dt_unix - 6 * 3600

    return {
        "_source": "open-meteo-current",
        "coord": {"lat": lat, "lon": lon},
        "weather": [{"id": weather_code, "description": "weather"}],
        "main": {
            "temp": temp if temp is not None else 0.0,
            "feels_like": feels_like if feels_like is not None else (temp if temp is not None else 0.0),
            "humidity": humidity,
            "pressure": pressure,
        },
        "wind": {"speed": (wind_kmh if wind_kmh is not None else 0.0) / 3.6, "deg": wind_deg},
        "sys": {"country": country_code, "sunrise": sunrise, "sunset": sunset},
        "dt": dt_unix,
        "timezone": 0,
        "name": place_name,
        "visibility": None,
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _http
    _http = httpx.AsyncClient(timeout=8.0)
    yield
    await _http.aclose()


app = FastAPI(
    title="MeteoGlobe API",
    description="Weather data proxy for the 3D globe frontend",
    lifespan=lifespan,
)


@app.get("/", include_in_schema=False)
async def root():
    return FileResponse("public/index.html", headers={"Cache-Control": "no-store"})


@app.get("/api/config", summary="Public frontend runtime config")
async def config():
    # Values here are intentionally frontend-visible.
    return {
        "tile_url_template": TILE_URL_TEMPLATE,
        "tile_proxy_url_template": "/api/tile/{z}/{x}/{y}.png",
        "tile_attribution": TILE_ATTRIBUTION,
        "tile_min_level": TILE_MIN_LEVEL,
        "tile_overlay_min_zoom": TILE_OVERLAY_MIN_ZOOM,
        "tile_bounds": TILE_BOUNDS,
    }


@app.get("/api/tile/{z}/{x}/{y}.png", summary="Proxy tile server image")
async def tile_proxy(z: int, x: int, y: int):
    if z < 0 or x < 0 or y < 0:
        raise HTTPException(status_code=400, detail="Invalid tile coordinate")

    url = render_tile_url(TILE_UPSTREAM_URL_TEMPLATE, z, x, y)
    try:
        assert _http is not None
        resp = await _http.get(url, follow_redirects=True)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Tile upstream unreachable: {e}") from e

    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail="Tile unavailable")

    content_type = resp.headers.get("content-type", "image/png")
    return Response(
        content=resp.content,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.get("/api/weather", summary="Current weather at a coordinate")
async def weather(lat: float, lon: float, force: bool = False):
    try:
        return await weather_payload(lat, lon, force=force)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/forecast", summary="48h forecast at a coordinate")
async def forecast(lat: float, lon: float, force: bool = False):
    om_key = f"om_forecast_{lat:.3f}_{lon:.3f}"
    payload = await fetch_json(
        "https://api.open-meteo.com/v1/forecast",
        om_key,
        params={
            "latitude": lat,
            "longitude": lon,
            "hourly": "temperature_2m,precipitation_probability,weather_code",
            "forecast_days": 3,
            "timezone": "UTC",
        },
        force=force,
    )
    data = build_open_meteo_forecast(payload if isinstance(payload, dict) else {})
    if data.get("list"):
        return data
    raise HTTPException(status_code=500, detail="Forecast unavailable")


class City(BaseModel):
    name: str
    lat: float
    lon: float


class CitiesRequest(BaseModel):
    cities: list[City]


@app.post("/api/cities", summary="Weather for a list of cities (parallel fetch)")
async def cities_weather(body: CitiesRequest, force: bool = False):
    sem = asyncio.Semaphore(8)

    async def fetch_city(city: City) -> dict[str, Any]:
        async with sem:
            try:
                w = await weather_payload(city.lat, city.lon, force=force)
                if not isinstance(w.get("name"), str) or not w.get("name"):
                    w["name"] = city.name
                return {**city.model_dump(), "weather": w}
            except Exception:
                # deterministic fallback so UI still renders markers
                approx_temp = round(22.0 - abs(city.lat) * 0.22, 1)
                now_ts = int(time.time())
                return {
                    **city.model_dump(),
                    "weather": {
                        "_source": "fallback-default-city",
                        "coord": {"lat": city.lat, "lon": city.lon},
                        "weather": [{"id": 800, "description": "weather"}],
                        "main": {"temp": approx_temp, "humidity": None, "pressure": None},
                        "wind": {"speed": 0.0, "deg": None},
                        "sys": {"country": "", "sunrise": now_ts - 6 * 3600, "sunset": now_ts + 6 * 3600},
                        "dt": now_ts,
                        "timezone": 0,
                        "name": city.name,
                    },
                }

    results = await asyncio.gather(*[fetch_city(c) for c in body.cities])
    return results


@app.get("/api/geocode", summary="Convert city name to lat/lon")
async def geocode(q: str):
    qq = (q or "").strip()
    if len(qq) < 2:
        return []

    key = f"geo_{qq.lower()}"
    cached = cache_get(key)
    if cached is not None:
        return cached

    try:
        raw = await fetch_json(
            "https://nominatim.openstreetmap.org/search",
            key,
            ttl=3600,
            headers={"User-Agent": "MeteoGlobe/1.0 (local app)"},
            params={"q": qq, "format": "jsonv2", "addressdetails": 1, "limit": 8},
        )
        out: list[dict[str, Any]] = []
        if isinstance(raw, list):
            for item in raw:
                if not isinstance(item, dict):
                    continue
                lat = as_float(item.get("lat"))
                lon = as_float(item.get("lon"))
                if lat is None or lon is None:
                    continue
                address = item.get("address") if isinstance(item.get("address"), dict) else {}
                display_name = str(item.get("display_name") or "").strip()
                name = (
                    address.get("city")
                    or address.get("town")
                    or address.get("village")
                    or address.get("municipality")
                    or address.get("county")
                    or address.get("state")
                    or (display_name.split(",")[0] if display_name else "Unknown")
                )
                out.append(
                    {
                        "name": name,
                        "lat": lat,
                        "lon": lon,
                        "country": str(address.get("country_code") or "").upper(),
                        "state": address.get("state") or "",
                    }
                )
        cache_set(key, out, ttl=3600)
        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/icon/{code}", summary="Weather pictogram from local files")
async def icon(code: int):
    if code not in SUPPORTED_ICON_CODES:
        raise HTTPException(status_code=400, detail="Icon code must be 1-42 or 101-142")

    if code in _icon_cache:
        raw, ct = _icon_cache[code]
        return Response(content=raw, media_type=ct, headers={"Cache-Control": "public, max-age=86400"})

    for ext, ct in ((".svg", "image/svg+xml"), (".png", "image/png")):
        local_path = os.path.join(ICON_LOCAL_DIR, f"{code}{ext}")
        if os.path.isfile(local_path):
            with open(local_path, "rb") as fh:
                raw = fh.read()
            _icon_cache[code] = (raw, ct)
            return Response(content=raw, media_type=ct, headers={"Cache-Control": "public, max-age=86400"})

    raise HTTPException(
        status_code=404,
        detail="Icon file not found locally in public/icons. Rebuild image with committed icon files.",
    )


@app.get("/{filename:path}", include_in_schema=False)
async def public_files(filename: str):
    path = os.path.join("public", filename)
    if os.path.isfile(path):
        lower = filename.lower()
        if lower.endswith((".html", ".js", ".css")):
            return FileResponse(path, headers={"Cache-Control": "no-store"})
        return FileResponse(path, headers={"Cache-Control": "public, max-age=3600"})
    raise HTTPException(status_code=404)


if __name__ == "__main__":
    import uvicorn

    print(f"\n[MeteoGlobe]  http://localhost:{PORT}")
    print(f"[API docs]    http://localhost:{PORT}/docs\n")

    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=PORT,
        reload=True,
    )
