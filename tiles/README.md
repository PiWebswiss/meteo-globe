# Self-Hosted Tiles (Raspberry Pi + Docker)

This project can use a self-hosted raster tile server.
Docker install guide for Debian/Raspberry Pi OS:
https://docs.docker.com/engine/install/debian/

## 1) Import OSM data once

Download a region extract (`.osm.pbf`) from Geofabrik, then import:

```bash
docker run --rm \
  -v /absolute/path/to/your-region.osm.pbf:/data/region.osm.pbf \
  -v osm-data:/data/database/ \
  -v osm-tiles:/data/tiles/ \
  overv/openstreetmap-tile-server:2.3.0 \
  import
```

Notes:
- Run this once per dataset.
- Start with a small region on Raspberry Pi (country/region, not whole planet).

## 2) Run the tile server

If you only want to run tileserver:

```bash
docker compose -f docker-compose.tileserver.yml up -d
```

The compose file pins `overv/openstreetmap-tile-server:2.3.0` (includes arm64 support).

Tiles endpoint:

```text
http://<PI_IP>:8081/tile/{z}/{x}/{y}.png
```

If your import is regional (not planet), the app will show a low-res global fallback and then your detailed tiles as you zoom into imported coverage.

## 3) Point MeteoGlobe to your Pi tiles

Set in `docker-compose.yml` for MeteoGlobe:

```yaml
environment:
  TILE_URL_TEMPLATE: "http://<PI_IP>:8081/tile/{z}/{x}/{y}.png"
  TILE_MIN_LEVEL: 0
  TILE_OVERLAY_MIN_ZOOM: 5
  # Optional regional bounds (west,south,east,north):
  # TILE_BOUNDS: "5.9,45.8,10.5,47.9"
  TILE_ATTRIBUTION: "(c) OpenStreetMap contributors (self-hosted)"
```

Then restart MeteoGlobe:

```bash
docker compose up -d --build
```

Or start both services in one command from the main compose file:

```bash
docker compose up -d --build
```

Quick exam preflight:

```bash
bash scripts/exam-check.sh
```

## 4) Resource tips for Pi

- Use region extracts only.
- Keep `TILE_MIN_LEVEL` at `0` (or `1` max) and tune `TILE_OVERLAY_MIN_ZOOM` instead.
- Set `TILE_BOUNDS` for regional imports to avoid full-globe blue overlays.
- Keep `THREADS` low (1-2) on small Pi devices.
- Keep `shm_size` >= `192m` if rendering errors mention shared memory.
- Prefer SSD storage for tile DB/cache volumes; SD cards are usually too slow for good render latency.
