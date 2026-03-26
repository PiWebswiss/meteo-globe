# Self-Hosted Tiles (Raspberry Pi + Docker)

This project can use a self-hosted raster tile server.

## 1) Import OSM data once

Download a region extract (`.osm.pbf`) from Geofabrik, then import:

```bash
docker run --rm \
  -v /absolute/path/to/your-region.osm.pbf:/data/region.osm.pbf \
  -v osm-data:/data/database/ \
  -v osm-tiles:/data/tiles/ \
  overv/openstreetmap-tile-server \
  import
```

Notes:
- Run this once per dataset.
- Start with a small region on Raspberry Pi (country/region, not whole planet).

## 2) Run the tile server

```bash
docker compose -f docker-compose.tileserver.yml up -d
```

Tiles endpoint:

```text
http://<PI_IP>:8081/tile/{z}/{x}/{y}.png
```

## 3) Point MeteoGlobe to your Pi tiles

Set in `docker-compose.yml` for MeteoGlobe:

```yaml
environment:
  TILE_URL_TEMPLATE: "http://<PI_IP>:8081/tile/{z}/{x}/{y}.png"
  TILE_ATTRIBUTION: "© OpenStreetMap contributors (self-hosted)"
```

Then restart MeteoGlobe:

```bash
docker compose up -d --build
```

## 4) Resource tips for Pi

- Use region extracts only.
- Keep `THREADS` low (1-2) on small Pi devices.
- Keep `shm_size` >= `192m` if rendering errors mention shared memory.

