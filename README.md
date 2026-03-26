# MeteoGlobe

Interactive 3D weather globe with local MeteoSwiss icons.

## Requirements

- Docker Desktop
- OpenWeatherMap key (optional, fallback exists)

## Configure keys

Edit `docker-compose.yml`:

```yaml
environment:
  OWM_API_KEY: "YOUR_OWM_KEY" # optional
  TILE_URL_TEMPLATE: "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
  TILE_ATTRIBUTION: "© OpenStreetMap contributors"
```

Notes:
- The globe renderer is CesiumJS with OpenStreetMap tiles, so no Google key or map id is required.
- `OWM_API_KEY` is optional. If missing, backend falls back to Open-Meteo.
- `TILE_URL_TEMPLATE` can point to your own tile server.
- Self-hosted setup guide for Raspberry Pi is in `tiles/README.md`.

## Run

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
- `docker-compose.yml`: runtime env/config

## Troubleshooting

- Blank globe: verify outbound access to `unpkg.com` and `tile.openstreetmap.org`, then hard refresh (`Ctrl+F5`).
- If using self-hosted tiles, verify your `TILE_URL_TEMPLATE` endpoint is reachable from the browser.
- Icons missing: make sure `public/icons` exists in the container.
- Port conflict: change `3000:3000` to another free port.
