# MeteoGlobe 🌍

A 3D interactive weather globe. The Earth spins in your browser — click any country or city to see live weather conditions, forecasts, and animated sky effects (rain, snow, sun…). Weather icons come from the official **MeteoSwiss** pictogram set. Zooming into Switzerland reveals live data from ~170 real measurement stations.

---

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- OpenWeatherMap API key is optional (recommended for primary provider)

---

## 1 — Get your free API key

1. Go to <https://openweathermap.org/api>
2. Click **Sign Up** and create a free account
3. After signing in, go to **API keys** (top-right menu → your username)
4. Copy the default key that was created for you
5. Wait ~10 minutes before using it — new keys need time to activate

The free plan gives you **1 000 calls/day**, which is more than enough for personal use.

---

## 2 — Setup & run

**Paste your key** into `docker-compose.yml` (one line to edit):

```yaml
OWM_API_KEY: paste_your_key_here
```

Then start the app:

```bash
docker compose up -d --build
```

Open <http://localhost:3000> in your browser — done.

> The first build downloads Python and installs dependencies (~1 min).
> Every start after that is instant (`docker compose up`).

To stop:

```bash
docker compose down
```

---

## 3 — Uninstall (remove everything)

Stop the app and delete all Docker data it created (image, container, cache):

```bash
docker compose down --rmi all
```

Then delete this folder. That's it — nothing else is installed on your machine.

---

## Project structure

```
Meteo-app/
│
├── docker-compose.yml     ← only file you need to edit (your API key)
├── Dockerfile             ← builds the Python image
├── server.py              ← FastAPI backend (weather proxy + icon cache)
├── requirements.txt       ← Python dependencies (installed inside Docker)
│
└── public/                ← frontend (HTML + CSS + JS, no build step)
    ├── index.html
    ├── style.css
    ├── app.js             ← globe, markers, search, panel, screensaver
    └── weather-fx.js      ← canvas weather animations (rain, snow, sun…)
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Globe is black | Check browser console (F12) — usually Globe.gl CDN unreachable |
| 401 errors in console | OWM key is wrong or not yet active (wait 10 min) |
| Weather icons show as emoji | MeteoSwiss CDN unavailable — emoji fallback is intentional, data is still correct |
| Port 3000 already in use | Change both `3000` values in `docker-compose.yml` to e.g. `3001` |
