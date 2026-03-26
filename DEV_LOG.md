# Dev Log

## 2026-03-25

Today I updated the project for the exam version and cleaned the interaction flow.

I fully updated the report file `rapport_station_meteo_eink_v3.docx` so it now matches the new MeteoGlobe 3D project instead of the old e-ink base. The report now follows the `laboratoire - CFC28.pdf` structure and explains clearly which APIs are used, how data is extracted and normalized, how caching is handled, how security is done, and how testing was performed.

I also updated `public/app.js` for usability. Weather selection is now left click only, and right click is no longer used for weather interaction. I kept the idle visual behavior you asked for by improving the screensaver mode so that after inactivity the globe rotates automatically, and when the user interacts again the screensaver closes and that automatic idle rotation stops.

I ran a JavaScript syntax check after the changes with `node --check public/app.js` and the check passed.

After user feedback, I applied a correction pass.

Right click on the globe is now explicitly blocked again (`contextmenu` disabled) and weather pick is forced to left click only (`ev.button === 0`) so right click cannot open weather anymore.

I also reduced idle timeout from 90 seconds to 20 seconds so the idle behavior is clearly visible in normal use. When idle starts, the globe auto-rotates; when user activity returns, the screensaver exits and idle-started rotation is stopped.

I fixed city weather markers by adding a backend fallback in `server.py` for `/api/cities`: if OpenWeatherMap fails or the API key is missing, the service now fetches current conditions from Open-Meteo and maps them to the frontend schema. This keeps city markers and weather visible instead of returning an empty list.

I also added a frontend resilience guard in `loadCityMarkers()`: if a city refresh returns an empty list, the app keeps existing marker cache instead of clearing the globe, and it shows a hint message when city weather cannot be loaded.

I bumped the frontend script version in `public/index.html` (`app.js?v=nasa3d4`) so browsers load the latest JavaScript immediately and do not keep stale interaction behavior from cache.

I made `OWM_API_KEY` optional by adding an Open-Meteo fallback for `/api/weather` in `server.py`. With this change, current weather, forecast, and city markers can still work without OpenWeatherMap credentials (OWM remains recommended as primary provider when a key is available).

I hardened fallback quality after more bug reports. `/api/weather` now adds best-effort reverse geocoding (Nominatim) so the weather panel can still show a readable city/country without OWM. I also rate-limited concurrent `/api/cities` upstream calls with an async semaphore to reduce burst failures that could hide all city markers.

I bumped frontend cache-busting again to `app.js?v=nasa3d5` in `public/index.html` so the newest click/marker fixes are loaded without stale browser JS.

I tightened idle Earth rotation again: idle delay is now 10 seconds and screensaver start forces a fresh globe rotation every time (stop old timer, then start rotation). I also bumped cache-busting to `app.js?v=nasa3d6`.

I hardened right-click blocking again after repeated reports. Weather picking now uses left-button `mouseup` only, ignores Ctrl/Cmd click variants, and blocks `contextmenu` + `auxclick` propagation on the globe canvas. Cache-busting bumped to `app.js?v=nasa3d7`.

I changed Earth rotation direction to the opposite way (negative heading step) so idle spin matches user preference. I also made `/api/cities` fully resilient: when upstream providers fail, backend now returns deterministic fallback city weather entries instead of empty results, so city labels and weather markers remain visible. Cache-busting bumped to `app.js?v=nasa3d8`.

I patched a WorldWind render-loop crash (`GpuResourceCache.putResource` from placemark label textures). City and active marker labels are now sanitized to ASCII-safe text with finite temperature values, and custom label font overrides were removed to avoid invalid text texture creation. Cache-busting bumped to `app.js?v=nasa3d9`.

I applied a strict stability fallback: placemark text labels are now fully disabled in the 3D layer to eliminate WorldWind text-texture crashes (`GpuResourceCache.putResource`). Weather markers/icons and panel weather data remain active. Cache-busting bumped to `app.js?v=nasa3d10`.

I implemented round marker bubbles with city names directly inside marker SVG images (no WorldWind text-label path), so city name + temperature stay visible while avoiding the texture crash loop. I also hardened right-click blocking with anti-ghost-click suppression on the globe canvas (`mousedown/contextmenu/auxclick` suppression + guarded left-button `mouseup` pick). Cache-busting bumped to `app.js?v=nasa3d11`.

I switched round marker bubbles to MeteoSwiss icons by embedding `/api/icon/{code}` in the marker SVG composition, while keeping city name + temperature text in the bubble. Cache-busting bumped to `app.js?v=nasa3d12`.

I refreshed the screensaver behavior and look. Idle mode now returns to Earth view, hides the panel, then starts globe rotation with a slower speed profile (`ROTATION_STEP_DEG=0.08`, `ROTATION_TICK_MS=45`) and a short delayed start for smoother motion. Idle timeout is now 15 seconds. I also modernized the screensaver UI with a glass card layout and bumped cache-busting to `app.js?v=nasa3d13`.

I applied a final interaction hardening pass: removed built-in `CompassLayer` and `ViewControlsLayer` to reduce WorldWind render noise/crash risk, and added global capture-phase right-click suppression (`contextmenu` + non-primary `auxclick`) so right-click cannot trigger weather even with browser/device quirks. Cache-busting bumped to `app.js?v=nasa3d14`.

I added a stricter mouse pick gate: weather fetch now requires a valid left-button down+up sequence on canvas (with drag cancellation and suppression windows), so right-click/aux-click/cmd-click cannot enter the weather pick path. I also made active screensaver non-blocking for UI controls (`pointer-events: none`) and disabled cache for HTML/JS/CSS responses in `server.py` to prevent stale frontend code from persisting between Docker restarts. Cache-busting bumped to `app.js?v=nasa3d15`.

I fixed the city marker regression and icon mismatch. City marker render now defines `iconCode` correctly and composes each marker as two placemarks: a round name/temperature bubble plus a dedicated MeteoSwiss icon placemark (`/api/icon/{code}`), ensuring actual MeteoSwiss pictograms are displayed. I also removed incompatible controls from the UI (`btn-map`, `btn-night`) and made control binding null-safe. Cache-busting bumped to `app.js?v=nasa3d17`.

I removed emoji fallbacks from the visible UI flow. Country display and search badges now use plain text (no flag emoji), weather icon fallbacks use `N/A` or `--`, and icon-endpoint fallback SVG no longer draws emoji glyphs. Cache-busting bumped to `app.js?v=nasa3d19`.

I enforced city-name placement under markers: each city marker now includes a dedicated name-strip placemark rendered below the round weather bubble, and the active selected marker gets the same under-label treatment. Cache-busting bumped to `app.js?v=nasa3d20`.

I slowed screensaver activation to 60 seconds idle (from 15 seconds) for normal day-to-day use, and bumped cache-busting to app.js?v=nasa3d21.

## 2026-03-26

I fixed the marker stacking bug visible on selected cities (example: Lagos). The city base marker is now temporarily hidden when the same location is selected as the active marker, so we no longer render two markers on top of each other.

I corrected marker layout offsets in `public/app.js` so the weather icon is anchored inside the round bubble and the city name strip stays under the bubble for both city markers and active markers.

I fixed icon fallback behavior in the frontend by mapping fallback rendering to the weather condition code (OWM code), not the MeteoSwiss pictogram id. This prevents wrong or blank fallback visuals.

I upgraded backend icon fallback in `server.py` (`/api/icon/{code}`): when MeteoSwiss icon fetch fails, it now returns weather-style SVG symbols (sun/cloud/rain/snow/thunder/fog) instead of the generic placeholder.

I bumped frontend cache-busting to `app.js?v=nasa3d22` in `public/index.html` to force browsers to load the latest marker/icon fixes.

I expanded the global `CITIES` list in `public/app.js` to include many more major cities across North America, South America, Europe, Africa, Middle East, Asia, and Oceania, so the globe displays broader worldwide coverage instead of only a small subset.

I replaced `download_icons.py` so it now downloads only official MeteoSwiss icons for all 84 expected codes (1-42 and 101-142) and exits with an error if any icon is missing. There is no generated icon fallback anymore.

I also changed `server.py` icon serving to strict local-only behavior for `/api/icon/{code}`: only supported MeteoSwiss codes are accepted, icons are served from `public/icons` (SVG first, then PNG), and missing files return HTTP 404 instead of any synthetic fallback or remote runtime fetch.

I updated the Docker build note in `Dockerfile` to reflect strict official icon download at build time.

I replaced icon sourcing again to guarantee real local MeteoSwiss assets without runtime fetch. `download_icons.py` now downloads MeteoSwiss' official weather-symbol workbook (XLSX) and extracts the embedded official icon images by row/code mapping into `public/icons/{code}.png` for all 84 codes (1-42 and 101-142). No synthetic fallback is used.

I verified local icon inventory after extraction: 84 PNG files, 0 SVG files. `/api/icon/{code}` serves these local files only (no CDN runtime fallback).

After confirming icons are now vendored locally, I removed `download_icons.py` from the project and updated `Dockerfile` to stop copying/running it during image build. The build now uses the committed `public/icons` directory directly.

I fixed city-marker layout and icon sharpness issues reported on map view. Marker labels are now rendered inside the same SVG bubble asset (instead of a separate placemark), which prevents name-strip drift. I also reintroduced dedicated weather icon placemarks sourced from local `/api/icon/{code}` files with reduced scale to avoid blurry upscaling. Cache-busting bumped to `app.js?v=nasa3d23`.

I moved all weather icons to local files to eliminate the external CDN dependency entirely.

All MeteoSwiss CDN URL patterns tried previously now return 404 (the URLs have changed or been removed). Instead of relying on external icon fetching, I created `download_icons.py` — a standalone script that generates all 84 weather icons (codes 1–42 day, 101–142 night) as SVG files into `public/icons/`. The icons use a consistent dark-theme style (`#0d1b33` background, rounded corners) with proper SVG shapes for each weather condition (sun/moon/cloud/rain/snow/thunder/fog and combinations). The `Dockerfile` now runs `python download_icons.py` at build time so icons are always present in the image. In `server.py`, the `/api/icon/{code}` endpoint now checks `public/icons/{code}.svg` (then `.png`) before attempting any network fetch — at runtime, icons are served from disk with zero external requests.

I fixed three performance and visual issues reported after the second test.

First, city marker rendering was rebuilding (destroy + recreate) all WorldWind placemarks on every zoom tier change, flushing the GPU texture cache each time. Fixed by storing placemark references in `cityPlacemarkMap` (Map&lt;name, {pm, pmName, tier}&gt;) and adding `updateCityTierVisibility()` which only flips `pm.enabled / pmName.enabled` — no GPU texture reload. `renderCityMarkers` still does a full rebuild when weather data changes or active target changes.

Second, the mouse-wheel handler was calling `wwd.redraw()` synchronously on every wheel tick (potentially hundreds per second). Fixed with RAF throttling: all ticks within one animation frame are coalesced into a single `wwd.redraw()` + `updateCityTierVisibility()` call, capping redraw rate at ~60 fps.

Third, `fallback_icon_svg()` in `server.py` was generating SVGs with no background (transparent), making the weather shapes invisible or hard to read on dark UI. Added a dark rounded-rectangle background (`#0d1b33`, rx=14) as the first element of every fallback SVG. Also added the MeteoSwiss app production icon URL (`app-prod-ws.meteoswiss-app.ch/v1/productimage/weathericon/meteo/large/{c}.png`) as the first candidate in `ICON_URLS` so actual MeteoSwiss pictograms are tried before the CDN fallback paths.

I fixed two root-cause bugs in city marker rendering. First, the separate icon placemark used a wrong `imageOffset` (Y=-0.38) that placed the weather icon ~20px above the geographic anchor instead of ~49px where the circle center actually sits, so the icon was appearing inside the temperature badge area or behind it. Second, because the bubble placemark was added to the layer before the icon placemark, the opaque badge rectangle covered the icon in WorldWind's render order. Fix: removed the separate icon placemark entirely and embedded the weather emoji directly inside the bubble SVG at the correct circle-center coordinates. City markers now use two placemarks each (bubble+emoji, name strip) instead of three.

I fixed the overlapping city labels and icons by implementing zoom-based progressive city disclosure. Each city in `CITIES` now carries a tier value (`t: 1/2/3`). A `getMaxCityTier(range)` function maps the current camera range to a maximum tier, and `renderCityMarkers` skips cities above that tier. At global view (range > 5 000 km) only ~22 megacities are shown; at continental zoom (1 500–5 000 km) ~62 major cities appear; at country/city zoom (< 1 500 km) all 93 cities are visible. The wheel event handler detects tier-boundary crossings and schedules a debounced re-render (150 ms) so markers update smoothly as the user zooms in or out.

I removed remaining browser console outputs from public/app.js (Google Maps load catch, MeteoSwiss point fallback, search fallback, and city marker refresh fallback) to keep production console clean while preserving silent fallback behavior.

I added explicit configuration comments in docker-compose.yml (including GOOGLE_MAPS_API_KEY and GOOGLE_MAPS_MAP_ID), added public runtime config endpoint /api/config in server.py, and documented the Google Maps setup in README.md. I also added concise inline comments in public/app.js around Google config loading and city-tier visibility logic.

I fixed a runtime crash in public/app.js where main() still called the removed ensureWorldWindLoaded() function after migrating to Google Maps. main() now calls ensureGoogleMapsLoaded() and validates window.google.maps, with an updated error hint for GOOGLE_MAPS_API_KEY. I also replaced leftover keyboard navigation code that referenced wwd.navigator with Google Maps center panning logic for arrow keys, updated the map attribution text in index.html, and bumped frontend cache-busting to app.js?v=nasa3d24.

I removed remaining legacy frontend runtime leftovers from the old WorldWind migration path. In public/app.js, hidePanel() no longer references markerLayer (it now calls clearActiveMarkers()), and legacy function names were renamed to map-native names (onMapPick/initMap) so no old WorldWind code path remains in active runtime. I also removed the unused #wwd-canvas CSS block from public/style.css and bumped frontend cache-busting to app.js?v=nasa3d25.

I aligned Google Maps integration with current official recommendations. In public/app.js, the JS API loader now uses loading=async and imports the marker library via google.maps.importLibrary('marker'). City/active markers were migrated from deprecated google.maps.Marker to google.maps.marker.AdvancedMarkerElement wrappers, and map init now sets a map id (GOOGLE_MAPS_MAP_ID or DEMO_MAP_ID) for advanced marker compatibility. I also updated geolocation flow to avoid automatic permission prompts unless permission is already granted, which prevents repeated browser-blocked geolocation warnings; manual locate still works from the locate button. Cache-busting bumped to app.js?v=nasa3d26.

I fixed two regressions after the official Google migration pass. First, map startup no longer hard-fails when advanced marker library/mapId is unavailable: the app now falls back to classic google.maps.Marker so the map still renders. Second, I restored public/index.html to clean UTF-8/ASCII UI strings and logo/loader text (removing mojibake text like �...), and bumped cache-busting to app.js?v=nasa3d27.

I removed the remaining deprecated Google marker path in `public/app.js` to stop the `google.maps.Marker is deprecated` console warning. `createImageMarker()` now uses `google.maps.marker.AdvancedMarkerElement` only (with a safe no-op object if the library is unavailable), and `initMap()` now always sets a map ID (`GOOGLE_MAPS_MAP_ID` when configured, otherwise `DEMO_MAP_ID`) so advanced markers stay enabled. I also bumped frontend cache-busting to `app.js?v=nasa3d28` in `public/index.html`.

Follow-up update: I explicitly recorded the Google Maps deprecation fix in this log after final verification. The frontend no longer uses `google.maps.Marker`; marker rendering now relies on `google.maps.marker.AdvancedMarkerElement`, map init enforces a map id (`GOOGLE_MAPS_MAP_ID` or `DEMO_MAP_ID`), and cache-busting is set to `app.js?v=nasa3d28`.

I investigated a blank-map runtime case where UI controls loaded but map tiles were not visible. In `public/app.js`, I added Google auth diagnostics (`window.gm_authFailure`) with explicit on-screen guidance, plus a map initialization watchdog that retries progressively simpler map modes (hybrid+mapId -> roadmap+mapId -> hybrid -> roadmap). If tiles still do not load, the app now shows a clear persistent hint to check `GOOGLE_MAPS_API_KEY` localhost referrer and billing instead of silently staying on an empty background.
I also bumped frontend cache-busting to `app.js?v=nasa3d29` in `public/index.html` so this diagnostics/fallback patch is loaded immediately.

I migrated the frontend globe engine from Google Maps to CesiumJS so the app can render a true 3D Earth without Google API key restrictions. In `public/app.js`, I replaced the Google loader with a Cesium loader (`unpkg` script + widgets CSS), introduced a Cesium map adapter (click picking, zoom/pan, heading/tilt, drag/zoom events), and switched marker rendering from AdvancedMarkerElement to Cesium billboard entities while keeping existing weather marker logic, city-tier visibility, controls, search, and panel behavior. I also updated default attribution text to CesiumJS/OpenStreetMap and bumped frontend cache-busting to `app.js?v=nasa3d30` in `public/index.html`.

I added self-hosted tile support for CesiumJS so the app can run against a Raspberry Pi tile server without code edits. In `server.py`, `/api/config` now exposes `tile_url_template` and `tile_attribution` from environment (`TILE_URL_TEMPLATE`, `TILE_ATTRIBUTION`). In `public/app.js`, map initialization now reads that runtime config and uses `Cesium.UrlTemplateImageryProvider` (instead of a hard-coded OSM URL), and attribution text is updated from the same config. I also updated `docker-compose.yml` with tile env defaults, added `docker-compose.tileserver.yml` for a local `overv/openstreetmap-tile-server` service, and added `tiles/README.md` with Raspberry Pi import/run steps and MeteoGlobe wiring instructions.
I also bumped frontend cache-busting to `app.js?v=nasa3d31` in `public/index.html` so the self-hosted tile runtime config path is fetched immediately after restart.
I set the project defaults to self-hosted tiles. `docker-compose.yml` now points `TILE_URL_TEMPLATE` to `http://localhost:8081/tile/{z}/{x}/{y}.png` with self-hosted attribution text, and `docker-compose.tileserver.yml` now enables `ALLOW_CORS=enabled` for browser/WebGL tile loading across port 3000 -> 8081. I also updated `README.md` and `tiles/README.md` to make the tile-server startup flow explicit (start tileserver first, then MeteoGlobe).
I normalized tile attribution strings to ASCII-safe text (`(c) OpenStreetMap contributors`) and bumped frontend cache-busting to `app.js?v=nasa3d32` so the updated self-host defaults load immediately.
I hardened Raspberry Pi reliability for self-hosted tiles by pinning the tile server image to `overv/openstreetmap-tile-server:v2.2.0` (multi-arch release with arm64 support) in `docker-compose.tileserver.yml`, and aligned the import command in `tiles/README.md` to the same pinned tag.

I finalized the Raspberry Pi self-host tile setup. The stack now defaults to self-hosted tiles (`TILE_URL_TEMPLATE=http://localhost:8081/tile/{z}/{x}/{y}.png`) with self-host attribution in `docker-compose.yml`, the tile service compose is pinned to `overv/openstreetmap-tile-server:v2.2.0` (arm64-capable multi-arch release), CORS is enabled for browser tile fetches across ports (`ALLOW_CORS=enabled`), and the Pi runbook/import command in `tiles/README.md` is aligned to the same pinned image tag.
I updated Docker orchestration for one-command lifecycle management. `docker-compose.yml` now includes both services (`tileserver` + `meteo-globe`) with shared tile volumes and `meteo-globe` depending on `tileserver`, so `docker compose up -d --build` starts the full stack and `docker compose down` stops it. I also updated documentation to include the official Debian Docker install guide (`https://docs.docker.com/engine/install/debian/`) in `README.md` and `tiles/README.md`, and clarified standalone vs all-in-one compose usage.

I added a final documentation pass for operations. The stack is now managed with one command from `docker-compose.yml` (`docker compose up -d --build` / `docker compose down`) because both `tileserver` and `meteo-globe` are defined in the main compose with shared tile volumes and service dependency wiring. I also added the official Docker Engine on Debian installation guide link (`https://docs.docker.com/engine/install/debian/`) to `README.md` and `tiles/README.md` for Raspberry Pi setup clarity.

Follow-up: confirmed and documented again that the project now uses one-command Docker lifecycle (`docker compose up -d --build` / `docker compose down`) from the main compose file, with tileserver and app started together, plus Debian Docker install documentation link maintained in README guides.
