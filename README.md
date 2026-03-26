# MeteoGlobe

Interactive 3D weather globe with local MeteoSwiss icons.

## Requirements

- Docker (Debian install guide: https://docs.docker.com/engine/install/debian/)
- OpenWeatherMap key (optional, fallback exists)

## Configure keys

Edit `docker-compose.yml`:

```yaml
environment:
  OWM_API_KEY: "YOUR_OWM_KEY" # optional
  TILE_URL_TEMPLATE: "http://localhost:8081/tile/{z}/{x}/{y}.png"
  TILE_ATTRIBUTION: "(c) OpenStreetMap contributors (self-hosted)"
```

Notes:
- The globe renderer is CesiumJS.
- `OWM_API_KEY` is optional. If missing, backend falls back to Open-Meteo.
- `TILE_URL_TEMPLATE` points to your self-hosted tile endpoint.
- Self-hosted tile setup for Raspberry Pi is in `tiles/README.md`.
- When tiles are regional only, the app now shows a built-in low-res global fallback layer until you zoom into imported tile coverage.

## Run

Start everything (tileserver + app) with one command:

```bash
docker compose up -d --build
```

Open:
- http://localhost:3000

Stop:

```bash
docker compose down
```

## Project layout

- `server.py`: FastAPI backend (weather proxy, icon serving, config endpoint)
- `public/app.js`: globe UI, markers, weather panel
- `public/icons/`: local MeteoSwiss icon assets
- `docker-compose.yml`: app + self-hosted tile service
- `docker-compose.tileserver.yml`: optional standalone tile-service compose

## Troubleshooting

- Blank globe: verify `http://localhost:8081/tile/0/0/0.png` is reachable, then hard refresh (`Ctrl+F5`).
- If loading from another device, set `TILE_URL_TEMPLATE` to `http://<HOST_IP>:8081/tile/{z}/{x}/{y}.png`.
- Icons missing: make sure `public/icons` exists in the container.
- Port conflict: change `3000:3000` / `8081:80` to free ports.
