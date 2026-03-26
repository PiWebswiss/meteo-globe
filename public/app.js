/*
  MeteoGlobe - NASA WorldWind edition
  Core behavior: click weather, search, locate, forecast panel, weather FX.
*/

const OWM_TO_METEO = {
  800: { d: 1, n: 101 },
  801: { d: 2, n: 102 },
  802: { d: 3, n: 103 },
  803: { d: 4, n: 104 },
  804: { d: 5, n: 105 },
  300: { d: 7, n: 7 }, 301: { d: 7, n: 7 }, 302: { d: 7, n: 7 },
  500: { d: 7, n: 7 }, 501: { d: 8, n: 8 }, 502: { d: 9, n: 9 }, 503: { d: 9, n: 9 },
  511: { d: 26, n: 26 },
  520: { d: 17, n: 17 }, 521: { d: 18, n: 18 }, 522: { d: 19, n: 19 }, 531: { d: 19, n: 19 },
  600: { d: 13, n: 13 }, 601: { d: 14, n: 14 }, 602: { d: 15, n: 15 },
  620: { d: 17, n: 17 }, 621: { d: 18, n: 18 }, 622: { d: 15, n: 15 },
  200: { d: 23, n: 23 }, 201: { d: 20, n: 20 }, 202: { d: 21, n: 21 },
  741: { d: 25, n: 25 },
};

const CH_BOUNDS = { minLat: 45.8, maxLat: 47.9, minLon: 5.9, maxLon: 10.5 };
const HOME_VIEW = { lat: 20, lon: 10, range: 12_000_000 };
const ROTATION_STEP_DEG = 0.08;
const ROTATION_TICK_MS = 45;

let wwd;
let weatherFX;
let markerLayer;
let cityLayer = null;
let cityWeatherCache = [];
let activeTarget = null;
let activeMarkerData = null;
let useFahrenheit = false;
let userLocation = null;
let refreshInFlight = false;
let rotateTimer = null;
let searchTimer = null;
let hintTimer = null;
let cityRetryTimer = null;
let worldwindLoadPromise = null;
let zoomRenderTimer = null;
let lastZoomTier = 1;
let cityPlacemarkMap = new Map(); // name → {pm, pmIcon, tier}

// t: city tier — 1=megacity (always shown), 2=major city (shown at regional zoom), 3=smaller city (shown when zoomed in)
const CITIES = [
  { name: 'New York',     lat: 40.71,  lon: -74.01,  t: 1 },
  { name: 'Washington',   lat: 38.91,  lon: -77.04,  t: 2 },
  { name: 'Boston',       lat: 42.36,  lon: -71.06,  t: 3 },
  { name: 'Miami',        lat: 25.76,  lon: -80.19,  t: 2 },
  { name: 'Atlanta',      lat: 33.75,  lon: -84.39,  t: 3 },
  { name: 'Dallas',       lat: 32.78,  lon: -96.80,  t: 2 },
  { name: 'Houston',      lat: 29.76,  lon: -95.37,  t: 2 },
  { name: 'Seattle',      lat: 47.61,  lon: -122.33, t: 3 },
  { name: 'San Francisco',lat: 37.77,  lon: -122.42, t: 2 },
  { name: 'Los Angeles',  lat: 34.05,  lon: -118.24, t: 1 },
  { name: 'Chicago',      lat: 41.88,  lon: -87.63,  t: 1 },
  { name: 'Vancouver',    lat: 49.28,  lon: -123.12, t: 3 },
  { name: 'Toronto',      lat: 43.65,  lon: -79.38,  t: 2 },
  { name: 'Montreal',     lat: 45.50,  lon: -73.57,  t: 3 },
  { name: 'Mexico City',  lat: 19.43,  lon: -99.13,  t: 1 },
  { name: 'Bogota',       lat: 4.71,   lon: -74.07,  t: 2 },
  { name: 'Lima',         lat: -12.05, lon: -77.04,  t: 2 },
  { name: 'Santiago',     lat: -33.45, lon: -70.67,  t: 2 },
  { name: 'São Paulo',    lat: -23.55, lon: -46.63,  t: 1 },
  { name: 'Rio de Janeiro', lat: -22.91, lon: -43.20, t: 2 },
  { name: 'Buenos Aires', lat: -34.60, lon: -58.38,  t: 1 },
  { name: 'Dublin',       lat: 53.35,  lon: -6.26,   t: 2 },
  { name: 'London',       lat: 51.51,  lon: -0.13,   t: 1 },
  { name: 'Lisbon',       lat: 38.72,  lon: -9.14,   t: 2 },
  { name: 'Paris',        lat: 48.85,  lon: 2.35,    t: 1 },
  { name: 'Brussels',     lat: 50.85,  lon: 4.35,    t: 2 },
  { name: 'Prague',       lat: 50.08,  lon: 14.44,   t: 2 },
  { name: 'Berlin',       lat: 52.52,  lon: 13.40,   t: 1 },
  { name: 'Warsaw',       lat: 52.23,  lon: 21.01,   t: 2 },
  { name: 'Madrid',       lat: 40.42,  lon: -3.70,   t: 2 },
  { name: 'Barcelona',    lat: 41.39,  lon: 2.17,    t: 2 },
  { name: 'Rome',         lat: 41.90,  lon: 12.50,   t: 2 },
  { name: 'Amsterdam',    lat: 52.37,  lon: 4.90,    t: 2 },
  { name: 'Copenhagen',   lat: 55.68,  lon: 12.57,   t: 2 },
  { name: 'Stockholm',    lat: 59.33,  lon: 18.07,   t: 2 },
  { name: 'Oslo',         lat: 59.91,  lon: 10.75,   t: 3 },
  { name: 'Helsinki',     lat: 60.17,  lon: 24.94,   t: 3 },
  { name: 'Vienna',       lat: 48.21,  lon: 16.37,   t: 2 },
  { name: 'Budapest',     lat: 47.50,  lon: 19.04,   t: 2 },
  { name: 'Athens',       lat: 37.98,  lon: 23.73,   t: 2 },
  { name: 'Bucharest',    lat: 44.43,  lon: 26.10,   t: 3 },
  { name: 'Belgrade',     lat: 44.79,  lon: 20.45,   t: 3 },
  { name: 'Kyiv',         lat: 50.45,  lon: 30.52,   t: 2 },
  { name: 'Zurich',       lat: 47.38,  lon: 8.54,    t: 3 },
  { name: 'Geneva',       lat: 46.20,  lon: 6.15,    t: 3 },
  { name: 'Berne',        lat: 46.95,  lon: 7.45,    t: 3 },
  { name: 'Moscow',       lat: 55.75,  lon: 37.62,   t: 1 },
  { name: 'Casablanca',   lat: 33.57,  lon: -7.59,   t: 2 },
  { name: 'Algiers',      lat: 36.75,  lon: 3.06,    t: 3 },
  { name: 'Tunis',        lat: 36.81,  lon: 10.18,   t: 3 },
  { name: 'Dakar',        lat: 14.69,  lon: -17.44,  t: 3 },
  { name: 'Accra',        lat: 5.56,   lon: -0.20,   t: 3 },
  { name: 'Istanbul',     lat: 41.01,  lon: 28.98,   t: 1 },
  { name: 'Cairo',        lat: 30.04,  lon: 31.24,   t: 1 },
  { name: 'Lagos',        lat: 6.52,   lon: 3.38,    t: 1 },
  { name: 'Addis Ababa',  lat: 8.98,   lon: 38.79,   t: 3 },
  { name: 'Nairobi',      lat: -1.29,  lon: 36.82,   t: 2 },
  { name: 'Kigali',       lat: -1.95,  lon: 30.06,   t: 3 },
  { name: 'Johannesburg', lat: -26.20, lon: 28.04,   t: 2 },
  { name: 'Cape Town',    lat: -33.92, lon: 18.42,   t: 2 },
  { name: 'Riyadh',       lat: 24.71,  lon: 46.67,   t: 2 },
  { name: 'Dubai',        lat: 25.20,  lon: 55.27,   t: 1 },
  { name: 'Abu Dhabi',    lat: 24.45,  lon: 54.38,   t: 3 },
  { name: 'Doha',         lat: 25.29,  lon: 51.53,   t: 3 },
  { name: 'Muscat',       lat: 23.59,  lon: 58.41,   t: 3 },
  { name: 'Jerusalem',    lat: 31.77,  lon: 35.21,   t: 3 },
  { name: 'Tehran',       lat: 35.69,  lon: 51.39,   t: 2 },
  { name: 'Karachi',      lat: 24.86,  lon: 67.01,   t: 2 },
  { name: 'Mumbai',       lat: 19.08,  lon: 72.88,   t: 1 },
  { name: 'Delhi',        lat: 28.61,  lon: 77.21,   t: 1 },
  { name: 'Dhaka',        lat: 23.81,  lon: 90.41,   t: 3 },
  { name: 'Kathmandu',    lat: 27.72,  lon: 85.32,   t: 3 },
  { name: 'Colombo',      lat: 6.93,   lon: 79.86,   t: 3 },
  { name: 'Bangkok',      lat: 13.75,  lon: 100.52,  t: 2 },
  { name: 'Kuala Lumpur', lat: 3.14,   lon: 101.69,  t: 3 },
  { name: 'Jakarta',      lat: -6.21,  lon: 106.85,  t: 2 },
  { name: 'Hanoi',        lat: 21.03,  lon: 105.85,  t: 3 },
  { name: 'Ho Chi Minh City', lat: 10.82, lon: 106.63, t: 3 },
  { name: 'Manila',       lat: 14.60,  lon: 120.98,  t: 2 },
  { name: 'Hong Kong',    lat: 22.32,  lon: 114.17,  t: 2 },
  { name: 'Taipei',       lat: 25.03,  lon: 121.56,  t: 2 },
  { name: 'Beijing',      lat: 39.91,  lon: 116.39,  t: 1 },
  { name: 'Shanghai',     lat: 31.23,  lon: 121.47,  t: 1 },
  { name: 'Tokyo',        lat: 35.68,  lon: 139.69,  t: 1 },
  { name: 'Osaka',        lat: 34.69,  lon: 135.50,  t: 3 },
  { name: 'Seoul',        lat: 37.57,  lon: 126.98,  t: 1 },
  { name: 'Singapore',    lat: 1.35,   lon: 103.82,  t: 1 },
  { name: 'Sydney',       lat: -33.87, lon: 151.21,  t: 1 },
  { name: 'Melbourne',    lat: -37.81, lon: 144.96,  t: 2 },
  { name: 'Perth',        lat: -31.95, lon: 115.86,  t: 3 },
  { name: 'Auckland',     lat: -36.85, lon: 174.76,  t: 3 },
  { name: 'Wellington',   lat: -41.29, lon: 174.78,  t: 3 },
];

// Quick lookup: city name → tier
const CITY_TIER = new Map(CITIES.map(c => [c.name, c.t]));

// Zoom thresholds: returns max tier to display at given camera range (metres)
// range > 5M  → only megacities (t≤1, ~22 cities)
// range 1.5M–5M → major cities (t≤2, ~60 cities)
// range < 1.5M → all cities   (t≤3, 93 cities)
function getMaxCityTier(range) {
  if (range > 5_000_000) return 1;
  if (range > 1_500_000) return 2;
  return 3;
}

const WORLDWIND_SOURCES = [
  'https://worldwind.arc.nasa.gov/web/worldwind-0.11.0/worldwind.min.js',
  'https://cdn.jsdelivr.net/npm/worldwindjs@1.9.0/build/dist/worldwind.min.js',
  'https://unpkg.com/worldwindjs@1.9.0/build/dist/worldwind.min.js',
];

function loadScriptWithTimeout(src, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let done = false;

    const finish = (ok, err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (ok) resolve();
      else reject(err || new Error(`Failed to load ${src}`));
    };

    const timer = setTimeout(() => {
      finish(false, new Error(`Timed out while loading ${src}`));
    }, timeoutMs);

    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => finish(true);
    script.onerror = () => finish(false, new Error(`Error while loading ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureWorldWindLoaded() {
  if (window.WorldWind) return true;
  if (worldwindLoadPromise) {
    try {
      await worldwindLoadPromise;
    } catch (_) {}
    return !!window.WorldWind;
  }

  worldwindLoadPromise = (async () => {
    let lastErr = null;
    for (const src of WORLDWIND_SOURCES) {
      try {
        await loadScriptWithTimeout(src);
        if (window.WorldWind) return true;
      } catch (err) {
        lastErr = err;
        console.warn('WorldWind source failed:', src, err?.message || err);
      }
    }
    throw lastErr || new Error('No WorldWind source loaded successfully');
  })();

  try {
    await worldwindLoadPromise;
  } catch (err) {
    console.error('WorldWind loading failed:', err);
  }
  return !!window.WorldWind;
}

function isOverSwitzerland(lat, lon) {
  return lat >= CH_BOUNDS.minLat && lat <= CH_BOUNDS.maxLat
      && lon >= CH_BOUNDS.minLon && lon <= CH_BOUNDS.maxLon;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showEl(id, active) {
  const el = document.getElementById(id);
  if (!el) return;
  if (active) el.classList.add('active');
  else el.classList.remove('active');
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function getMeteoIcon(owmCode, daytime = true) {
  const m = OWM_TO_METEO[owmCode];
  if (m) return daytime ? m.d : m.n;
  if (owmCode >= 200 && owmCode < 300) return 20;
  if (owmCode >= 300 && owmCode < 400) return 7;
  if (owmCode >= 500 && owmCode < 600) return 8;
  if (owmCode >= 600 && owmCode < 700) return 14;
  if (owmCode >= 700 && owmCode < 800) return 24;
  return 1;
}

function getWeatherEmoji(owmCode, daytime = true) {
  if (owmCode >= 200 && owmCode < 300) return '⛈️';
  if (owmCode >= 300 && owmCode < 400) return '🌧️';
  if (owmCode >= 500 && owmCode < 600) return '🌦️';
  if (owmCode >= 600 && owmCode < 700) return '🌨️';
  if (owmCode >= 700 && owmCode < 800) return '🌫️';
  if (owmCode === 800) return daytime ? '☀️' : '🌙';
  if (owmCode === 801) return '⛅';
  if (owmCode === 802) return '🌤️';
  if (owmCode === 803 || owmCode === 804) return '☁️';
  return '❔';
}

function buildWeatherIconDataUrl(owmCode, daytime = true) {
  const emoji = getWeatherEmoji(owmCode, daytime);
  const iconText = escapeXml(emoji);
  const svg = `\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">\n  <text x="48" y="62" text-anchor="middle" font-size="58" font-family="Segoe UI Emoji,Apple Color Emoji,Segoe UI Symbol,Arial,sans-serif" fill="#ffffff">${iconText}</text>\n</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function resolveWeatherIconSource(iconCode, owmCode, daytime, callback) {
  const apiUrl = `/api/icon/${iconCode}`;
  const iconImg = new Image();
  iconImg.onload = () => callback(apiUrl);
  iconImg.onerror = () => callback(buildWeatherIconDataUrl(owmCode, daytime));
  iconImg.src = apiUrl;
}

function isDaytime(data) {
  if (!data || !data.sys) return true;
  if (!data.sys.sunrise || !data.sys.sunset) return true;
  return data.dt >= data.sys.sunrise && data.dt <= data.sys.sunset;
}

function tempColor(c) {
  if (c < -15) return '#00bfff';
  if (c < 0) return '#64b5f6';
  if (c < 10) return '#81c784';
  if (c < 20) return '#ffd54f';
  if (c < 30) return '#ff9800';
  return '#f44336';
}

function displayTemp(c) {
  if (useFahrenheit) return `${Math.round(c * 9 / 5 + 32)}°F`;
  return `${Math.round(c)}°C`;
}

function asFiniteNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeCityName(name, maxLen = 14) {
  return (name || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function tempBadgeText(c) {
  const n = asFiniteNumber(c, 0);
  if (useFahrenheit) {
    const f = Math.round(n * 9 / 5 + 32);
    return `${f > 0 ? '+' : ''}${f}F`;
  }
  const v = Math.round(n);
  return `${v > 0 ? '+' : ''}${v}C`;
}

function buildRoundMarkerDataUrl({ name, temp, active = false, showName = false }) {
  const t = asFiniteNumber(temp, 0);
  const color = tempColor(t);
  const tempTxt = escapeXml(tempBadgeText(t));
  const r = active ? 38 : 34;
  const by = active ? 64 : 58;
  const cx = 80;
  const cy = by - 20;
  const city = escapeXml(safeCityName(name || (active ? 'Selected' : 'City'), active ? 20 : 16));
  const nameW = active ? 126 : 110;
  const nameX = (160 - nameW) / 2;
  const nameY = active ? 94 : 90;
  const nameFs = active ? 12 : 11;
  const namePart = showName
    ? `<rect x="${nameX}" y="${nameY}" width="${nameW}" height="24" rx="12" ry="12" fill="rgba(6,14,30,0.92)" stroke="rgba(170,205,255,0.62)" stroke-width="1.5"/>
  <text x="80" y="${nameY + 16}" text-anchor="middle" font-size="${nameFs}" font-weight="700" font-family="Arial, sans-serif" fill="#e5f0ff">${city}</text>`
    : '';
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 132">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(8,18,38,0.92)" stroke="${color}" stroke-width="4"/>
  <circle cx="${cx}" cy="${cy}" r="${active ? 22 : 20}" fill="rgba(255,255,255,0.04)" />
  <rect x="${active ? 44 : 50}" y="${by}" width="${active ? 72 : 60}" height="24" rx="12" ry="12" fill="rgba(8,18,38,0.95)" stroke="${color}" stroke-width="2"/>
  <text x="80" y="${by + 17}" text-anchor="middle" font-size="13" font-weight="700" font-family="Arial, sans-serif" fill="#ffffff">${tempTxt}</text>
  ${namePart}
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildNameStripDataUrl(name, active = false) {
  const city = escapeXml(safeCityName(name || (active ? 'Selected' : 'City'), active ? 20 : 16));
  const w = active ? 126 : 110;
  const x = (160 - w) / 2;
  const h = 24;
  const y = 58;
  const fs = active ? 12 : 11;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 96">
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" ry="12" fill="rgba(6,14,30,0.92)" stroke="rgba(170,205,255,0.62)" stroke-width="1.5"/>
  <text x="80" y="${y + 16}" text-anchor="middle" font-size="${fs}" font-weight="700" font-family="Arial, sans-serif" fill="#e5f0ff">${city}</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function windDir(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((deg || 0) / 45) % 8];
}

function localTime(data) {
  if (!data || !Number.isFinite(data.timezone) || !Number.isFinite(data.dt)) return '';
  const d = new Date((data.dt + data.timezone) * 1000);
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m} (local)`;
}

function sunTime(ts) {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function flashHint(message, duration = 2600) {
  const hint = document.getElementById('hint');
  if (!hint) return;
  hint.textContent = message;
  hint.classList.remove('fade');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hint.classList.add('fade'), duration);
}

function apiPath(path, params = {}) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return `${url.pathname}${url.search}`;
}

async function readErrorMessage(res) {
  try {
    const body = await res.json();
    if (typeof body?.detail === 'string') return body.detail;
  } catch (_) {}
  return `${res.status} ${res.statusText}`;
}

async function fetchWeatherAt(lat, lon, force = false) {
  const res = await fetch(apiPath('/api/weather', { lat, lon, force }));
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

async function fetchSwissPointWeather(lat, lon, force = false) {
  const res = await fetch(apiPath('/api/meteoswiss/point', { lat, lon, force }));
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return res.json();
}

async function fetchPointWeather(lat, lon, force = false) {
  if (isOverSwitzerland(lat, lon)) {
    try {
      return await fetchSwissPointWeather(lat, lon, force);
    } catch (err) {
      console.warn('MeteoSwiss point fetch failed, fallback to OWM:', err.message);
    }
  }
  return fetchWeatherAt(lat, lon, force);
}

function panelLoading() {
  setText('loc-city', 'Fetching...');
  setText('loc-country', '');
  setText('loc-time', '');
  setText('hero-temp', '-');
  setText('hero-desc', '');
  setText('hero-feels', '');
  showEl('weather-panel', true);
  document.getElementById('forecast-scroll').innerHTML =
    '<div class="forecast-placeholder">Loading...</div>';
}

function syncWeatherVisuals(code, day) {
  if (weatherFX) weatherFX.setWeather(code, day);
}

function showPanel(data, opts = {}) {
  const w0 = data?.weather?.[0] || { id: 800, description: 'weather' };
  const code = Number.isFinite(Number(w0.id)) ? Number(w0.id) : 800;
  const day = isDaytime(data);
  const iconCode = getMeteoIcon(code, day);
  const temp = Number.isFinite(data?.main?.temp) ? data.main.temp : 0;
  const feelsLike = Number.isFinite(data?.main?.feels_like) ? data.main.feels_like : temp;
  const tc = tempColor(temp);

  setText('loc-city', data.name || 'Unknown');
  setText('loc-country', `${data?.sys?.country || ''}`);
  setText('loc-time', localTime(data));

  if (data?._source === 'meteoswiss_point') {
    const st = data?.ms?.station;
    const nearest = (typeof st?.distance_km === 'number')
      ? ` | nearest ${st.abbreviation || st.name || 'station'} (${st.distance_km.toFixed(1)} km)`
      : '';
    setText('loc-country', `CH | MeteoSwiss precise${nearest}`);
    setText('data-source', 'MeteoSwiss CH Point');
  }

  const img = document.getElementById('hero-icon');
  const emo = document.getElementById('hero-emoji');
  img.style.display = 'block';
  emo.style.display = 'none';
  img.onload = () => {
    img.style.display = 'block';
    emo.style.display = 'none';
  };
  img.onerror = () => {
    img.src = buildWeatherIconDataUrl(code, day);
    img.style.display = 'block';
    emo.style.display = 'none';
  };
  img.src = `/api/icon/${iconCode}`;

  const tempEl = document.getElementById('hero-temp');
  tempEl.textContent = displayTemp(temp);
  tempEl.style.color = tc;
  setText('hero-desc', cap(w0.description || 'Weather'));
  setText('hero-feels', `Feels like ${displayTemp(feelsLike)}`);

  setText('s-humidity', data?.main?.humidity != null ? `${Math.round(data.main.humidity)}%` : '-');
  const wsRaw = Number.isFinite(data?.wind?.speed) ? data.wind.speed : null;
  const ws = wsRaw != null ? (wsRaw * 3.6).toFixed(0) : null;
  const wd = data?.wind?.deg != null ? ` ${windDir(data.wind.deg)}` : '';
  setText('s-wind', ws != null ? `${ws} km/h${wd}` : '-');
  setText('s-pressure', data?.main?.pressure != null ? `${Math.round(data.main.pressure)} hPa` : '-');
  setText('s-visibility', data?.visibility ? `${(data.visibility / 1000).toFixed(0)} km` : '-');
  setText('s-sunrise', sunTime(data?.sys?.sunrise));
  setText('s-sunset', sunTime(data?.sys?.sunset));

  showEl('weather-panel', true);
  activeMarkerData = data;
  activeTarget = opts.target || (data.coord ? { lat: data.coord.lat, lon: data.coord.lon, source: 'weather' } : null);

  syncWeatherVisuals(code, day);

  if (data.coord) {
    loadForecast(data.coord.lat, data.coord.lon, data.sys?.country, !!opts.force);
  }

  if (activeTarget?.lat != null && activeTarget?.lon != null) {
    setActiveMarker(activeTarget.lat, activeTarget.lon, temp, code, day, data.name || '');
    renderCityMarkers(cityWeatherCache);
  }

  document.getElementById('hint').classList.add('fade');
}

function hidePanel() {
  document.getElementById('weather-panel').classList.remove('active');
  if (weatherFX) weatherFX.clear();
  if (markerLayer) markerLayer.removeAllRenderables();
  activeMarkerData = null;
  activeTarget = null;
  renderCityMarkers(cityWeatherCache);
}

async function loadForecast(lat, lon, country, force = false) {
  const scroll = document.getElementById('forecast-scroll');
  scroll.innerHTML = '<div class="forecast-placeholder">Loading forecast...</div>';
  const src = document.getElementById('data-source');

  try {
    let list = null;
    let source = 'OpenWeatherMap';

    if (country === 'CH') {
      try {
        const res = await fetch(apiPath('/api/meteoswiss/forecast', { lat, lon, force }));
        if (!res.ok) throw new Error(await readErrorMessage(res));
        const ms = await res.json();
        if (ms.currentWeather || ms.forecast3h) {
          list = buildMSForecastList(ms);
          source = 'MeteoSwiss CH';
        } else if (ms.list) {
          list = ms.list;
        }
      } catch (_) {}
    }

    if (!list) {
      const res = await fetch(apiPath('/api/forecast', { lat, lon, force }));
      if (!res.ok) throw new Error(await readErrorMessage(res));
      const data = await res.json();
      list = data?.list || [];
      if (data?._source === 'open-meteo') source = 'Open-Meteo';
    }

    src.textContent = source;
    renderForecast(scroll, list);
  } catch (err) {
    const msg = err?.message || 'Forecast unavailable';
    scroll.innerHTML = `<div class="forecast-placeholder">Forecast unavailable (${msg})</div>`;
  }
}

function buildMSForecastList(ms) {
  const f = ms.forecast3h || ms.forecast1h || [];
  const base = ms.currentWeather?.time || Math.floor(Date.now() / 1000);
  return f.slice(0, 16).map((item, i) => ({
    dt: base + i * 3 * 3600,
    main: { temp: item.tt ?? item.temperature ?? 0 },
    weather: [{ id: meteoCodeToOwm(item.weatherIcon || item.symbol || 1), description: 'forecast' }],
    pop: Math.max(0, Math.min(1, (item.precipitation ?? 0) / 10)),
  }));
}

function meteoCodeToOwm(msCode) {
  const c = msCode > 100 ? msCode - 100 : msCode;
  if (c === 1) return 800;
  if (c === 2) return 801;
  if (c === 3) return 802;
  if (c === 4 || c === 5) return 803;
  if (c >= 6 && c <= 9) return 500;
  if (c >= 13 && c <= 15) return 601;
  if (c >= 20 && c <= 23) return 200;
  if (c >= 24 && c <= 25) return 741;
  return 800;
}

function renderForecast(scroll, list) {
  if (!list || !list.length) {
    scroll.innerHTML = '<div class="forecast-placeholder">No data</div>';
    return;
  }

  scroll.innerHTML = '';
  list.slice(0, 14).forEach((item) => {
    const dt = new Date(item.dt * 1000);
    const h = `${dt.getHours().toString().padStart(2, '0')}:00`;
    const t = Math.round(item.main?.temp ?? 0);
    const tc = tempColor(t);
    const day = dt.getHours() >= 6 && dt.getHours() < 20;
    const code = item.weather?.[0]?.id ?? 800;
    const iconCode = getMeteoIcon(code, day);
    const rain = item.pop ? `${Math.round(item.pop * 100)}%` : '';

    const cell = document.createElement('div');
    cell.className = 'fc-cell';
    cell.innerHTML = `
      <div class="fc-time">${h}</div>
      <div class="fc-icon">
        <img src="/api/icon/${iconCode}" alt="" onerror="this.outerHTML='<span>--</span>'">
      </div>
      <div class="fc-temp" style="color:${tc}">${t > 0 ? '+' : ''}${t}°</div>
      <div class="fc-rain">${rain}</div>
    `;
    scroll.appendChild(cell);
  });
}

function normalizeSearchText(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function doSearch(q, dropdown) {
  let results = [];
  try {
    const res = await fetch(apiPath('/api/geocode', { q }));
    if (!res.ok) throw new Error(await readErrorMessage(res));
    results = await res.json();
  } catch (err) {
    console.warn('Search failed:', err.message);
  }

  dropdown.innerHTML = '';
  if (!Array.isArray(results) || !results.length) {
    dropdown.innerHTML = '<div class="no-results">No locations found</div>';
    return;
  }

  results.slice(0, 8).forEach((r) => {
    const item = document.createElement('div');
    item.className = 'search-result';
    const cc = /^[A-Za-z]{2}$/.test(r.country || '') ? r.country.toUpperCase() : '';
    item.innerHTML = `
      <div>
        <div class="sr-name">${r.name}</div>
        <div class="sr-sub">${[r.state || '', cc || r.country || ''].filter(Boolean).join(' | ') || 'Location'}</div>
      </div>
      <span class="sr-flag">${cc || 'GLB'}</span>
    `;
    item.addEventListener('click', async () => {
      dropdown.innerHTML = '';
      document.getElementById('search-input').value = r.name;
      panelLoading();
      focusOn(r.lat, r.lon, 900000);
      try {
        const data = await fetchPointWeather(r.lat, r.lon);
        showPanel(data, { target: { lat: r.lat, lon: r.lon, source: 'search' } });
      } catch (err) {
        hidePanel();
        flashHint(`Search weather error: ${err.message}`, 4200);
      }
    });
    dropdown.appendChild(item);
  });
}

function initSearch() {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  const dropdown = document.getElementById('search-results');

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearBtn.style.display = q ? 'block' : 'none';
    clearTimeout(searchTimer);
    if (q.length < 2) {
      dropdown.innerHTML = '';
      return;
    }
    searchTimer = setTimeout(() => doSearch(q, dropdown), 250);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.style.display = 'none';
    dropdown.innerHTML = '';
    input.focus();
  });
}

function stopRotation() {
  if (rotateTimer) {
    clearInterval(rotateTimer);
    rotateTimer = null;
  }
  const btn = document.getElementById('btn-rotate');
  if (btn) btn.classList.remove('active');
}

function startRotation() {
  if (rotateTimer) return;
  rotateTimer = setInterval(() => {
    if (!wwd) return;
    // Negative step for opposite rotation direction.
    wwd.navigator.heading = (wwd.navigator.heading - ROTATION_STEP_DEG + 360) % 360;
    wwd.redraw();
  }, ROTATION_TICK_MS);
}

function toggleRotation() {
  const btn = document.getElementById('btn-rotate');
  if (rotateTimer) {
    stopRotation();
    if (btn) btn.classList.remove('active');
  } else {
    startRotation();
    if (btn) btn.classList.add('active');
  }
}

function focusOn(lat, lon, range = 1_000_000) {
  if (!wwd) return;
  wwd.navigator.lookAtLocation.latitude = lat;
  wwd.navigator.lookAtLocation.longitude = lon;
  wwd.navigator.range = Math.max(2_000, range);
  wwd.redraw();
}

function zoomIn() {
  if (!wwd) return;
  wwd.navigator.range = Math.max(2_000, wwd.navigator.range * 0.72);
  wwd.redraw();
}

function zoomOut() {
  if (!wwd) return;
  wwd.navigator.range = Math.min(40_000_000, wwd.navigator.range * 1.35);
  wwd.redraw();
}

function addBaseLayers() {
  const layers = [
    // NASA open imagery only (no proprietary providers).
    new WorldWind.BMNGLayer(),
    new WorldWind.BMNGLandsatLayer(),
    new WorldWind.AtmosphereLayer(),
    new WorldWind.StarFieldLayer(),
  ];

  layers.forEach(layer => {
    layer.enabled = true;
    wwd.addLayer(layer);
  });
}

function initMarkerLayer() {
  markerLayer = new WorldWind.RenderableLayer('Weather marker');
  wwd.addLayer(markerLayer);
}

function initCityLayer() {
  cityLayer = new WorldWind.RenderableLayer('Cities');
  wwd.addLayer(cityLayer);
}

function isNearActiveTarget(lat, lon) {
  if (!activeTarget || !Number.isFinite(activeTarget.lat) || !Number.isFinite(activeTarget.lon)) {
    return false;
  }
  // Keep the selected city hidden from the base city layer to avoid doubled markers.
  return Math.abs(activeTarget.lat - lat) <= 0.08 && Math.abs(activeTarget.lon - lon) <= 0.08;
}

function renderCityMarkers(results) {
  if (!cityLayer) return;
  cityLayer.removeAllRenderables();
  cityPlacemarkMap.clear();

  const range = wwd?.navigator?.range ?? HOME_VIEW.range;
  const maxTier = getMaxCityTier(range);
  lastZoomTier = maxTier;

  for (const r of results) {
    if (!r || !r.weather) continue;
    if (isNearActiveTarget(r.lat, r.lon)) continue;
    const cityTier = CITY_TIER.get(r.name) ?? 2;

    const w = r.weather;
    const code = w?.weather?.[0]?.id ?? 800;
    const day = isDaytime(w);
    const iconCode = getMeteoIcon(code, day);
    const temp = asFiniteNumber(w?.main?.temp, 0);
    const pos = new WorldWind.Position(r.lat, r.lon, 1200);

    const pm = new WorldWind.Placemark(pos, true, null);
    pm.alwaysOnTop = true;
    pm.enabled = cityTier <= maxTier;
    const attrs = new WorldWind.PlacemarkAttributes(null);
    attrs.imageSource = buildRoundMarkerDataUrl({ name: r.name, temp, active: false, showName: true });
    attrs.imageScale = 0.52;
    attrs.imageOffset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.5, WorldWind.OFFSET_FRACTION, 0.0);
    pm.attributes = attrs;
    cityLayer.addRenderable(pm);

    const pmIcon = new WorldWind.Placemark(pos, true, null);
    pmIcon.alwaysOnTop = true;
    pmIcon.enabled = cityTier <= maxTier;
    const iconAttrs = new WorldWind.PlacemarkAttributes(null);
    iconAttrs.imageSource = buildWeatherIconDataUrl(code, day);
    // Keep scale conservative because official MeteoSwiss PNG assets are low-resolution.
    iconAttrs.imageScale = 0.16;
    iconAttrs.imageOffset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.5, WorldWind.OFFSET_FRACTION, -0.20);
    pmIcon.attributes = iconAttrs;
    cityLayer.addRenderable(pmIcon);
    resolveWeatherIconSource(iconCode, code, day, (src) => {
      iconAttrs.imageSource = src;
      wwd.redraw();
    });

    cityPlacemarkMap.set(r.name, { pm, pmIcon, tier: cityTier });
  }
  wwd.redraw();
}

function updateCityTierVisibility() {
  if (!cityPlacemarkMap.size) return;
  const range = wwd?.navigator?.range ?? HOME_VIEW.range;
  const maxTier = getMaxCityTier(range);
  if (maxTier === lastZoomTier) return;
  lastZoomTier = maxTier;
  for (const { pm, pmIcon, tier } of cityPlacemarkMap.values()) {
    const show = tier <= maxTier;
    pm.enabled = show;
    if (pmIcon) pmIcon.enabled = show;
  }
  wwd.redraw();
}

function scheduleCityRetry(delayMs = 30_000) {
  if (cityRetryTimer) return;
  cityRetryTimer = setTimeout(async () => {
    cityRetryTimer = null;
    await loadCityMarkers(false);
  }, delayMs);
}

async function loadCityMarkers(force = false) {
  try {
    const res = await fetch(force ? '/api/cities?force=true' : '/api/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cities: CITIES }),
    });
    if (!res.ok) {
      if (!cityWeatherCache.length) {
        flashHint('City weather unavailable. Check API/network.', 4200);
        scheduleCityRetry();
      }
      return;
    }
    const next = await res.json();
    if (Array.isArray(next) && next.length) {
      cityWeatherCache = next;
      renderCityMarkers(cityWeatherCache);
      if (cityRetryTimer) {
        clearTimeout(cityRetryTimer);
        cityRetryTimer = null;
      }
      return;
    }
    if (!cityWeatherCache.length) {
      flashHint('City weather unavailable. Check API/network.', 4200);
      scheduleCityRetry();
    }
  } catch (err) {
    console.warn('City markers failed:', err.message);
    if (!cityWeatherCache.length) {
      flashHint('City weather unavailable. Check API/network.', 4200);
      scheduleCityRetry();
    }
  }
}

function setActiveMarker(lat, lon, temp, owmCode, day, name) {
  if (!markerLayer) return;
  markerLayer.removeAllRenderables();

  const pos = new WorldWind.Position(lat, lon, 1600);
  const iconCode = getMeteoIcon(owmCode, day);

  const pm = new WorldWind.Placemark(pos, true, null);
  pm.alwaysOnTop = true;
  const attrs = new WorldWind.PlacemarkAttributes(null);
  attrs.imageSource = buildRoundMarkerDataUrl({
    name: name || 'Selected',
    temp: asFiniteNumber(temp, 0),
    active: true,
    showName: true,
  });
  attrs.imageScale = 0.56;
  attrs.imageOffset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.5, WorldWind.OFFSET_FRACTION, 0.0);
  pm.attributes = attrs;
  markerLayer.addRenderable(pm);

  const pmIcon = new WorldWind.Placemark(pos, true, null);
  pmIcon.alwaysOnTop = true;
  const iconAttrs = new WorldWind.PlacemarkAttributes(null);
  iconAttrs.imageSource = buildWeatherIconDataUrl(owmCode, day);
  iconAttrs.imageScale = 0.18;
  iconAttrs.imageOffset = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.5, WorldWind.OFFSET_FRACTION, -0.20);
  pmIcon.attributes = iconAttrs;
  markerLayer.addRenderable(pmIcon);
  resolveWeatherIconSource(iconCode, owmCode, day, (src) => {
    iconAttrs.imageSource = src;
    wwd.redraw();
  });

  wwd.redraw();
}

function terrainCoordsFromMouseEvent(event) {
  if (!wwd) return null;
  const rect = wwd.canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const pickList = wwd.pickTerrain(new WorldWind.Vec2(x, y));
  if (!pickList) return null;

  const terrainObj = typeof pickList.terrainObject === 'function' ? pickList.terrainObject() : null;
  const position = terrainObj?.position || pickList?.objects?.[0]?.position || null;
  if (!position) return null;

  return {
    lat: position.latitude,
    lon: position.longitude,
  };
}

async function onWorldWindPick(lat, lon, source = 'manual') {
  stopRotation();
  focusOn(lat, lon, Math.max(2_500, (wwd?.navigator?.range || 900000) * 0.72));
  panelLoading();
  try {
    const data = await fetchPointWeather(lat, lon);
    showPanel(data, { target: { lat, lon, source } });
  } catch (err) {
    hidePanel();
    flashHint(`Weather error: ${err.message}`, 4200);
  }
}

function initWorldWind() {
  const container = document.getElementById('globe-container');
  container.innerHTML = '<canvas id="wwd-canvas"></canvas>';
  const canvas = document.getElementById('wwd-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  wwd = new WorldWind.WorldWindow('wwd-canvas');
  WorldWind.Logger.setLoggingLevel(WorldWind.Logger.LEVEL_WARNING);

  addBaseLayers();
  initMarkerLayer();
  initCityLayer();
  focusOn(HOME_VIEW.lat, HOME_VIEW.lon, HOME_VIEW.range);

  let suppressPickUntil = 0;
  let pickCandidate = false;
  let pickStartX = 0;
  let pickStartY = 0;
  const suppressPick = (ms = 700) => {
    suppressPickUntil = performance.now() + ms;
    pickCandidate = false;
  };

  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.buttons !== 1) {
      suppressPick();
      return;
    }
    pickCandidate = true;
    pickStartX = ev.clientX;
    pickStartY = ev.clientY;
  }, true);

  canvas.addEventListener('mousemove', (ev) => {
    if (!pickCandidate) return;
    const dx = ev.clientX - pickStartX;
    const dy = ev.clientY - pickStartY;
    if ((dx * dx + dy * dy) > 64) {
      pickCandidate = false; // dragged, not a click
    }
  }, true);

  canvas.addEventListener('mouseup', async (ev) => {
    // Weather pick is strictly left mouse button only.
    if (ev.button !== 0) {
      pickCandidate = false;
      return;
    }
    // Ignore Ctrl/Cmd-click variants that may emulate right-click.
    if (ev.ctrlKey || ev.metaKey) {
      pickCandidate = false;
      return;
    }
    if (performance.now() < suppressPickUntil || !pickCandidate) {
      pickCandidate = false;
      return;
    }
    pickCandidate = false;
    const p = terrainCoordsFromMouseEvent(ev);
    if (!p) return;
    await onWorldWindPick(p.lat, p.lon, 'manual');
  }, true);

  // Disable right-click interactions on the globe.
  canvas.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    suppressPick();
  }, true);

  // Block non-primary mouse button activation paths on some browsers.
  canvas.addEventListener('auxclick', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    suppressPick();
  }, true);

  // Hard global right-click block to avoid accidental weather picks from browser/device quirks.
  window.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    suppressPick();
  }, true);

  window.addEventListener('auxclick', (ev) => {
    if (ev.button !== 0) {
      ev.preventDefault();
      suppressPick();
    }
  }, true);

  let rafPending = false;
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    stopRotation();
    const factor = ev.deltaY < 0 ? 0.84 : 1.18;
    wwd.navigator.range = Math.max(2_000, Math.min(40_000_000, wwd.navigator.range * factor));
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        wwd.redraw();
        updateCityTierVisibility();
      });
    }
  }, { passive: false });

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    wwd.redraw();
  });

  setText('map-attrib', '3D viewer by NASA WorldWind | NASA Blue Marble imagery');
}

function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function getBestCurrentPosition() {
  try {
    return await new Promise((resolve, reject) => {
      let best = null;
      let done = false;
      let watchId = null;

      const finish = (pos, err) => {
        if (done) return;
        done = true;
        if (watchId != null) navigator.geolocation.clearWatch(watchId);
        clearTimeout(timeoutId);
        if (pos) resolve(pos);
        else reject(err || new Error('Unable to get location'));
      };

      watchId = navigator.geolocation.watchPosition(
        pos => {
          if (!best || (pos.coords?.accuracy ?? Infinity) < (best.coords?.accuracy ?? Infinity)) best = pos;
          if ((pos.coords?.accuracy ?? Infinity) <= 150) finish(pos, null);
        },
        err => {
          if (best) finish(best, null);
          else finish(null, new Error(err?.message || 'Location error'));
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 8000 },
      );

      const timeoutId = setTimeout(() => {
        if (best) finish(best, null);
        else finish(null, new Error('Location timeout'));
      }, 13000);
    });
  } catch (_) {
    return getCurrentPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
  }
}

async function locateAndShowUserWeather({ force = false, animate = true } = {}) {
  try {
    flashHint('Locating your position...');
    const pos = await getBestCurrentPosition();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const acc = Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null;
    userLocation = { lat, lon, acc };

    if (animate) {
      stopRotation();
      focusOn(lat, lon, 200000);
    }

    panelLoading();
    const data = await fetchPointWeather(lat, lon, force);
    showPanel(data, { target: { lat, lon, source: 'user' }, force });
    setText('loc-country', `${data?.sys?.country || ''} | Your location${acc != null ? ` | GPS +/- ${acc} m` : ''}`);
    flashHint('Live weather updated for your location');
  } catch (err) {
    flashHint('Location unavailable. Use search or click on the globe.', 4200);
  }
}

function initControls() {
  const zoomInBtn = document.getElementById('btn-zoom-in');
  const zoomOutBtn = document.getElementById('btn-zoom-out');
  const rotateBtn = document.getElementById('btn-rotate');
  const homeBtn = document.getElementById('btn-home');
  const locateBtn = document.getElementById('btn-locate');
  const refreshBtn = document.getElementById('btn-refresh');
  const closePanelBtn = document.getElementById('close-panel');
  const unitToggleBtn = document.getElementById('unit-toggle');

  if (zoomInBtn) zoomInBtn.addEventListener('click', () => {
    stopRotation();
    zoomIn();
  });

  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
    stopRotation();
    zoomOut();
  });

  if (rotateBtn) rotateBtn.addEventListener('click', () => {
    toggleRotation();
  });

  if (homeBtn) homeBtn.addEventListener('click', () => {
    stopRotation();
    focusOn(HOME_VIEW.lat, HOME_VIEW.lon, HOME_VIEW.range);
    hidePanel();
  });

  if (locateBtn) locateBtn.addEventListener('click', async () => {
    await locateAndShowUserWeather({ force: true, animate: true });
  });

  if (refreshBtn) refreshBtn.addEventListener('click', async () => {
    if (refreshInFlight) return;
    refreshInFlight = true;
    const btn = refreshBtn;
    btn.classList.add('busy');
    btn.disabled = true;
    flashHint('Refreshing weather...');

    try {
      if (activeTarget?.lat != null && activeTarget?.lon != null) {
        const d = await fetchPointWeather(activeTarget.lat, activeTarget.lon, true);
        showPanel(d, { target: activeTarget, force: true });
      } else if (userLocation) {
        await locateAndShowUserWeather({ force: true, animate: false });
      }
      await loadCityMarkers(true);
    } catch (err) {
      flashHint(`Refresh failed: ${err.message}`, 4200);
    } finally {
      refreshInFlight = false;
      btn.classList.remove('busy');
      btn.disabled = false;
    }
  });

  if (closePanelBtn) closePanelBtn.addEventListener('click', hidePanel);

  if (unitToggleBtn) unitToggleBtn.addEventListener('click', () => {
    useFahrenheit = !useFahrenheit;
    unitToggleBtn.textContent = useFahrenheit ? '°F' : '°C';
    if (activeMarkerData) showPanel(activeMarkerData, { target: activeTarget });
    else renderCityMarkers(cityWeatherCache);
  });

  window.addEventListener('keydown', e => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
    if (e.key === '+' || e.key === '=') zoomIn();
    else if (e.key === '-' || e.key === '_') zoomOut();
    else if (e.key === '0') focusOn(HOME_VIEW.lat, HOME_VIEW.lon, HOME_VIEW.range);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (!wwd) return;
      e.preventDefault();
      stopRotation();
      const step = Math.max(0.1, Math.min(15, wwd.navigator.range / 1_200_000));
      const nav = wwd.navigator.lookAtLocation;
      if      (e.key === 'ArrowLeft')  nav.longitude -= step;
      else if (e.key === 'ArrowRight') nav.longitude += step;
      else if (e.key === 'ArrowUp')    nav.latitude = Math.min(89, nav.latitude + step);
      else if (e.key === 'ArrowDown')  nav.latitude = Math.max(-89, nav.latitude - step);
      wwd.redraw();
    }
  });
}

function initWeatherFX() {
  weatherFX = new WeatherFX(document.getElementById('weather-canvas'));
  weatherFX.start();
}

async function main() {
  const loading = document.getElementById('loading-screen');
  const loaded = await ensureWorldWindLoaded();
  if (!loaded || !window.WorldWind) {
    if (loading) loading.classList.add('hidden');
    flashHint('NASA WorldWind failed to load from all sources. Check network, VPN/ad-block, then hard refresh (Ctrl+F5).', 7000);
    return;
  }

  initWorldWind();
  initSearch();
  initControls();
  initWeatherFX();

  flashHint('Click anywhere on the 3D globe for weather', 5000);

  if (loading) loading.classList.add('hidden');

  locateAndShowUserWeather({ force: false, animate: true });
  loadCityMarkers();
}

function initScreensaver() {
  const ss = document.getElementById('screensaver');
  const clock = document.getElementById('ss-clock');
  if (!ss || !clock) return;

  let idleTimer = null;
  let spinDelayTimer = null;
  let screensaverStartedRotation = false;
  const IDLE_MS = 60_000;

  function updateClock() {
    const now = new Date();
    clock.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }

  function showScreensaver() {
    updateClock();
    ss.classList.add('active');
    // Go back to Earth view in idle mode, then start a slower rotation.
    hidePanel();
    focusOn(HOME_VIEW.lat, HOME_VIEW.lon, HOME_VIEW.range);
    if (rotateTimer) stopRotation();
    clearTimeout(spinDelayTimer);
    spinDelayTimer = setTimeout(() => {
      if (!ss.classList.contains('active')) return;
      startRotation();
      screensaverStartedRotation = true;
    }, 450);
  }

  function dismissScreensaver() {
    ss.classList.remove('active');
    clearTimeout(spinDelayTimer);
    if (screensaverStartedRotation) {
      stopRotation();
      screensaverStartedRotation = false;
    }
    resetIdle();
  }

  function resetIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(showScreensaver, IDLE_MS);
  }

  setInterval(updateClock, 1000);

  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'].forEach(evt => {
    window.addEventListener(evt, () => {
      if (ss.classList.contains('active')) dismissScreensaver();
      else resetIdle();
    }, { passive: true });
  });

  resetIdle();
}

document.addEventListener('DOMContentLoaded', main);
document.addEventListener('DOMContentLoaded', initScreensaver);
