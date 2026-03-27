/*
  MeteoGlobe - CesiumJS edition
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

const HOME_VIEW = { lat: 20, lon: 10, range: 12_000_000 };
const ROTATION_STEP_DEG = 0.15;
const ROTATION_TICK_MS = 30;

let map;
let weatherFX;
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
let cesiumLoadPromise = null;
let runtimeConfig = null;
let mapContextMenuBound = false;
let zoomRenderTimer = null;
let lastZoomTier = 1;
let ambientWeatherCode = null;
let ambientWeatherDay = true;
let cityPlacemarkMap = new Map(); // name -> {bubble, icon, tier}
let activeMarkerObjects = [];

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

// Quick lookup: city name ? tier
const CITY_TIER = new Map(CITIES.map(c => [c.name, c.t]));

// Zoom thresholds: returns max tier to display at given camera range (metres)
// range > 5M  ? only megacities (t=1, ~22 cities)
// range 1.5M–5M ? major cities (t=2, ~60 cities)
// range < 1.5M ? all cities   (t=3, 93 cities)
function getMaxCityTier(range) {
  if (range > 5_000_000) return 1;
  if (range > 1_500_000) return 2;
  return 3;
}

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

function ensureStylesheetLoaded(href) {
  if (document.querySelector(`link[data-href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute('data-href', href);
  document.head.appendChild(link);
}

function rangeToZoom(range) {
  const r = Math.max(2_000, asFiniteNumber(range, HOME_VIEW.range));
  const z = 16 - Math.log2(r / 5_000);
  return Math.max(2, Math.min(18, Math.round(z)));
}

function zoomToRange(zoom) {
  const z = Math.max(2, Math.min(18, asFiniteNumber(zoom, 2)));
  return 5_000 * (2 ** (16 - z));
}

async function ensureCesiumLoaded() {
  if (window.Cesium?.Viewer) return true;
  if (cesiumLoadPromise) {
    try {
      await cesiumLoadPromise;
    } catch (_) {}
    return !!window.Cesium?.Viewer;
  }

  cesiumLoadPromise = (async () => {
    const base = 'https://unpkg.com/cesium@1.126.0/Build/Cesium/';
    window.CESIUM_BASE_URL = base;
    ensureStylesheetLoaded(`${base}Widgets/widgets.css`);
    await loadScriptWithTimeout(`${base}Cesium.js`, 22000);
    if (!window.Cesium?.Viewer) {
      throw new Error('Cesium script loaded but API unavailable');
    }
  })();

  try {
    await cesiumLoadPromise;
  } catch (_) {
  }
  return !!window.Cesium?.Viewer;
}

async function loadRuntimeConfig() {
  if (runtimeConfig) return runtimeConfig;
  let cfg = null;
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (res.ok) cfg = await res.json();
  } catch (_) {}
  runtimeConfig = cfg || {};
  return runtimeConfig;
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
  if (owmCode >= 200 && owmCode < 300) return 'TS';
  if (owmCode >= 300 && owmCode < 400) return 'DZ';
  if (owmCode >= 500 && owmCode < 600) return 'RN';
  if (owmCode >= 600 && owmCode < 700) return 'SN';
  if (owmCode >= 700 && owmCode < 800) return 'FG';
  if (owmCode === 800) return daytime ? 'SUN' : 'MOON';
  if (owmCode === 801) return 'PCLD';
  if (owmCode === 802) return 'SCLD';
  if (owmCode === 803 || owmCode === 804) return 'CLD';
  return 'WX';
}

function buildWeatherIconDataUrl(owmCode, daytime = true) {
  const txt = getWeatherEmoji(owmCode, daytime);
  const iconText = escapeXml(txt);
  const svg = `\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">\n  <rect x="8" y="8" width="80" height="80" rx="16" fill="#0d1b33"/>\n  <text x="48" y="58" text-anchor="middle" font-size="22" font-family="Inter,Segoe UI,Arial,sans-serif" fill="#ffffff" font-weight="700">${iconText}</text>\n</svg>`;
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
    return `${f > 0 ? '+' : ''}${f}\u00B0F`;
  }
  const v = Math.round(n);
  return `${v > 0 ? '+' : ''}${v}\u00B0C`;
}

// Canvas-rendered pill for city weather markers.
// Uses 2x internal scale and renders text at high quality for Cesium billboard.
function buildCityLabelCanvas({ temp }) {
  const t = asFiniteNumber(temp, 0);
  const color = tempColor(t);
  const tempTxt = tempBadgeText(t);
  // Display size 96x34. Canvas at 2x = 192x68 pixels.
  // Cesium billboard scale = 0.5 → maps 192px canvas to 96px display, pixel-perfect.
  const S = 2;
  const W = 96 * S, H = 34 * S;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // Pill background
  ctx.beginPath();
  ctx.roundRect(2 * S, 2 * S, W - 4 * S, H - 4 * S, (H / 2) - 2 * S);
  ctx.fillStyle = 'rgba(10,18,36,0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5 * S;
  ctx.stroke();

  // Color dot on the left
  ctx.beginPath();
  ctx.arc(17 * S, 17 * S, 5 * S, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Temperature text
  ctx.font = `800 ${14 * S}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(tempTxt, 58 * S, 17.5 * S);

  return c;
}

// Canvas-rendered tooltip for active/selected location.
function buildActiveMarkerCanvas({ name, temp }) {
  const t = asFiniteNumber(temp, 0);
  const color = tempColor(t);
  const tempTxt = tempBadgeText(t);
  const city = safeCityName(name || 'Selected', 16);
  const S = 2;
  const W = 120 * S, H = 46 * S;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // Tooltip background
  ctx.beginPath();
  ctx.roundRect(2 * S, 2 * S, W - 4 * S, H - 4 * S, 14 * S);
  ctx.fillStyle = 'rgba(10,18,36,0.92)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1.5 * S;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // City name
  ctx.font = `700 ${10 * S}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(city, W / 2, 15 * S);

  // Temperature
  ctx.font = `800 ${15 * S}px Inter, Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(tempTxt, W / 2, 33 * S);

  return c;
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

async function fetchPointWeather(lat, lon, force = false) {
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

  showEl('weather-panel', true);
  activeMarkerData = data;
  activeTarget = opts.target || (data.coord ? { lat: data.coord.lat, lon: data.coord.lon, source: 'weather' } : null);

  syncWeatherVisuals(code, day);

  if (data.coord) {
    loadForecast(data.coord.lat, data.coord.lon, !!opts.force);
  }

  if (activeTarget?.lat != null && activeTarget?.lon != null) {
    setActiveMarker(activeTarget.lat, activeTarget.lon, temp, code, day, data.name || '');
    renderCityMarkers(cityWeatherCache);
  }

  document.getElementById('hint').classList.add('fade');
}

function hidePanel() {
  document.getElementById('weather-panel').classList.remove('active');
  // Restore ambient weather FX (user's local weather) instead of clearing
  if (weatherFX && ambientWeatherCode != null) {
    weatherFX.setWeather(ambientWeatherCode, ambientWeatherDay);
  } else if (weatherFX) {
    weatherFX.clear();
  }
  clearActiveMarkers();
  activeMarkerData = null;
  activeTarget = null;
  renderCityMarkers(cityWeatherCache);
}

async function loadForecast(lat, lon, force = false) {
  const scroll = document.getElementById('forecast-scroll');
  scroll.innerHTML = '<div class="forecast-placeholder">Loading forecast...</div>';
  const src = document.getElementById('data-source');

  try {
    const res = await fetch(apiPath('/api/forecast', { lat, lon, force }));
    if (!res.ok) throw new Error(await readErrorMessage(res));
    const data = await res.json();
    const list = data?.list || [];

    src.textContent = 'Open-Meteo';
    renderForecast(scroll, list);
  } catch (err) {
    const msg = err?.message || 'Forecast unavailable';
    scroll.innerHTML = `<div class="forecast-placeholder">Forecast unavailable (${msg})</div>`;
  }
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
  } catch (_) {
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
    if (!map) return;
    // Spin the globe by shifting camera longitude for visible Earth rotation
    if (typeof map.rotateLon === 'function') {
      map.rotateLon(ROTATION_STEP_DEG);
    }
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
  if (!map) return;
  const zoom = rangeToZoom(range);
  map.panTo({ lat, lng: lon });
  map.setZoom(zoom);
}

function zoomIn() {
  if (!map) return;
  map.setZoom(Math.min(20, (map.getZoom() ?? 2) + 1));
}

function zoomOut() {
  if (!map) return;
  map.setZoom(Math.max(2, (map.getZoom() ?? 2) - 1));
}

function isNearActiveTarget(lat, lon) {
  if (!activeTarget || !Number.isFinite(activeTarget.lat) || !Number.isFinite(activeTarget.lon)) {
    return false;
  }
  // Keep the selected city hidden from the base city layer to avoid doubled markers.
  return Math.abs(activeTarget.lat - lat) <= 0.08 && Math.abs(activeTarget.lon - lon) <= 0.08;
}

function clearCityMarkers() {
  for (const { bubble, icon } of cityPlacemarkMap.values()) {
    if (bubble) bubble.setMap(null);
    if (icon) icon.setMap(null);
  }
  cityPlacemarkMap.clear();
}

function clearActiveMarkers() {
  for (const m of activeMarkerObjects) m.setMap(null);
  activeMarkerObjects = [];
}

function markerSizeValue(sizeOrNumber, fallback) {
  if (sizeOrNumber && typeof sizeOrNumber.width === 'number') return sizeOrNumber.width;
  const n = Number(sizeOrNumber);
  return Number.isFinite(n) ? n : fallback;
}

function markerPointValue(pointOrNumber, axis, fallback) {
  if (pointOrNumber && typeof pointOrNumber[axis] === 'number') return pointOrNumber[axis];
  const n = Number(pointOrNumber);
  return Number.isFinite(n) ? n : fallback;
}

function createImageMarker(lat, lon, imageSource, width, height, anchorX, anchorY, zIndex = 1000, visible = true) {
  if (!map?.viewer || !window.Cesium) {
    return {
      setMap() {},
      setVisible() {},
      setIcon() {},
    };
  }
  const C = window.Cesium;
  let removed = false;

  // If imageSource is a Canvas, use native resolution with scale — no resampling.
  // If it's a URL string, use explicit width/height as before.
  const isCanvas = imageSource instanceof HTMLCanvasElement;
  const billboardOpts = {
    image: imageSource,
    horizontalOrigin: C.HorizontalOrigin.LEFT,
    verticalOrigin: C.VerticalOrigin.TOP,
    pixelOffset: new C.Cartesian2(-anchorX, -anchorY),
    eyeOffset: new C.Cartesian3(0, 0, -(zIndex / 10)),
    disableDepthTestDistance: 0,
  };
  if (isCanvas) {
    // Canvas is rendered at 2x. Scale 0.5 maps canvas pixels 1:1 to screen pixels.
    // Cesium keeps the full-res texture — no resampling, no blur.
    billboardOpts.scale = 0.5;
  } else {
    billboardOpts.width = width;
    billboardOpts.height = height;
  }

  const entity = map.viewer.entities.add({
    position: C.Cartesian3.fromDegrees(lon, lat, 0),
    show: !!visible,
    billboard: billboardOpts,
  });

  return {
    setMap(nextMap) {
      if (removed) return;
      if (!nextMap) {
        map.viewer.entities.remove(entity);
        removed = true;
        return;
      }
      entity.show = true;
    },
    setVisible(nextVisible) {
      if (removed) return;
      entity.show = !!nextVisible;
    },
    setIcon(iconOpts) {
      if (removed || !entity.billboard) return;
      const nextUrl = iconOpts?.url || imageSource;
      const nextW = markerSizeValue(iconOpts?.scaledSize, width);
      const nextH = markerSizeValue(iconOpts?.scaledSize?.height, height);
      const nextAx = markerPointValue(iconOpts?.anchor, 'x', anchorX);
      const nextAy = markerPointValue(iconOpts?.anchor?.y, 'y', anchorY);
      entity.billboard.image = nextUrl;
      entity.billboard.width = nextW;
      entity.billboard.height = nextH;
      entity.billboard.scale = undefined;
      entity.billboard.pixelOffset = new C.Cartesian2(-nextAx, -nextAy);
    },
  };
}

function renderCityMarkers(results) {
  if (!map) return;
  clearCityMarkers();

  const zoom = map.getZoom() ?? 2;
  const maxTier = getMaxCityTier(zoomToRange(zoom));
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
    const show = cityTier <= maxTier;
    // Glass pill: 96x34, anchored at center-bottom (canvas-rendered for crisp text)
    const labelCanvas = buildCityLabelCanvas({ temp });
    const label = createImageMarker(r.lat, r.lon, labelCanvas, 96, 34, 48, 34, 1100, show);

    // Weather icon: inside the pill, vertically centered with the temp text
    const iconFallback = buildWeatherIconDataUrl(code, day);
    const icon = createImageMarker(r.lat, r.lon, iconFallback, 22, 22, 42, 28, 1200, show);
    resolveWeatherIconSource(iconCode, code, day, (src) => {
      icon.setIcon({
        url: src,
        scaledSize: { width: 22, height: 22 },
        anchor: { x: 42, y: 28 },
      });
    });

    cityPlacemarkMap.set(r.name, { bubble: label, icon, tier: cityTier });
  }
}

function updateCityTierVisibility() {
  if (!cityPlacemarkMap.size) return;
  const zoom = map?.getZoom?.() ?? 2;
  // Reuse the same tier thresholds used during marker creation.
  const maxTier = getMaxCityTier(zoomToRange(zoom));
  if (maxTier === lastZoomTier) return;
  lastZoomTier = maxTier;
  for (const { bubble, icon, tier } of cityPlacemarkMap.values()) {
    const show = tier <= maxTier;
    if (bubble) bubble.setVisible(show);
    if (icon) icon.setVisible(show);
  }
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
  } catch (_) {
    if (!cityWeatherCache.length) {
      flashHint('City weather unavailable. Check API/network.', 4200);
      scheduleCityRetry();
    }
  }
}

function setActiveMarker(lat, lon, temp, owmCode, day, name) {
  if (!map) return;
  clearActiveMarkers();
  const iconCode = getMeteoIcon(owmCode, day);
  const labelCanvas = buildActiveMarkerCanvas({
    name: name || 'Selected',
    temp: asFiniteNumber(temp, 0),
  });
  // Compact tooltip: 120x46, anchored at center-bottom (canvas-rendered for crisp text)
  const label = createImageMarker(lat, lon, labelCanvas, 120, 46, 60, 46, 2200, true);

  // Weather icon: inside tooltip, left of temperature at same vertical level
  const iconFallback = buildWeatherIconDataUrl(owmCode, day);
  const icon = createImageMarker(lat, lon, iconFallback, 22, 22, 52, 23, 2300, true);
  resolveWeatherIconSource(iconCode, owmCode, day, (src) => {
    icon.setIcon({
      url: src,
      scaledSize: { width: 22, height: 22 },
      anchor: { x: 52, y: 23 },
    });
  });
  activeMarkerObjects = [label, icon];
}

async function onMapPick(lat, lon, source = 'manual') {
  stopRotation();
  focusOn(lat, lon, Math.max(2_500, (zoomToRange(map?.getZoom?.() ?? 2)) * 0.72));
  panelLoading();
  try {
    const data = await fetchPointWeather(lat, lon);
    showPanel(data, { target: { lat, lon, source } });
  } catch (err) {
    hidePanel();
    flashHint(`Weather error: ${err.message}`, 4200);
  }
}

function normalizeLon(lon) {
  let out = lon;
  while (out < -180) out += 360;
  while (out > 180) out -= 360;
  return out;
}

function getCameraRange(viewer) {
  const h = viewer?.camera?.positionCartographic?.height;
  return Number.isFinite(h) ? h : HOME_VIEW.range;
}

function getCameraCenter(viewer) {
  if (!viewer || !window.Cesium) return { lat: HOME_VIEW.lat, lon: HOME_VIEW.lon };
  const C = window.Cesium;
  const scene = viewer.scene;
  const canvas = scene?.canvas;
  if (!canvas) return { lat: HOME_VIEW.lat, lon: HOME_VIEW.lon };
  const ray = viewer.camera.getPickRay(new C.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2));
  const picked = ray ? scene.globe.pick(ray, scene) : null;
  if (picked) {
    const cart = C.Cartographic.fromCartesian(picked);
    return {
      lat: C.Math.toDegrees(cart.latitude),
      lon: C.Math.toDegrees(cart.longitude),
    };
  }
  const cam = viewer.camera.positionCartographic;
  if (cam) {
    return {
      lat: C.Math.toDegrees(cam.latitude),
      lon: C.Math.toDegrees(cam.longitude),
    };
  }
  return { lat: HOME_VIEW.lat, lon: HOME_VIEW.lon };
}

function getHeadingDeg(viewer) {
  if (!viewer || !window.Cesium) return 0;
  const C = window.Cesium;
  const h = C.Math.toDegrees(viewer.camera.heading || 0);
  return ((h % 360) + 360) % 360;
}

function getTiltDeg(viewer) {
  if (!viewer || !window.Cesium) return 45;
  const C = window.Cesium;
  const p = C.Math.toDegrees(viewer.camera.pitch || 0);
  return Math.max(5, Math.min(85, Math.abs(p)));
}

function setCameraView(viewer, lat, lon, range, headingDeg = null, tiltDeg = null) {
  if (!viewer || !window.Cesium) return;
  const C = window.Cesium;
  const h = headingDeg == null ? getHeadingDeg(viewer) : headingDeg;
  const t = tiltDeg == null ? getTiltDeg(viewer) : tiltDeg;
  viewer.camera.setView({
    destination: C.Cartesian3.fromDegrees(normalizeLon(lon), Math.max(-85, Math.min(85, lat)), Math.max(2_000, range)),
    orientation: {
      heading: C.Math.toRadians(h),
      pitch: C.Math.toRadians(-Math.max(5, Math.min(85, t))),
      roll: 0,
    },
  });
}

function pickLatLonFromScreen(viewer, pos) {
  if (!viewer || !window.Cesium || !pos) return null;
  const C = window.Cesium;
  const cartesian = viewer.camera.pickEllipsoid(pos, viewer.scene.globe.ellipsoid);
  if (!cartesian) return null;
  const cartographic = C.Cartographic.fromCartesian(cartesian);
  return {
    lat: C.Math.toDegrees(cartographic.latitude),
    lon: C.Math.toDegrees(cartographic.longitude),
  };
}

function createCesiumMapAdapter(viewer) {
  const C = window.Cesium;
  const listeners = {
    click: [],
    zoom_changed: [],
    dragstart: [],
  };
  const emit = (type, payload) => {
    const list = listeners[type] || [];
    for (const cb of [...list]) {
      try { cb(payload); } catch (_) {}
    }
  };

  const handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((movement) => {
    const ll = pickLatLonFromScreen(viewer, movement?.position);
    if (!ll) return;
    emit('click', {
      latLng: {
        lat: () => ll.lat,
        lng: () => ll.lon,
      },
    });
  }, C.ScreenSpaceEventType.LEFT_CLICK);
  handler.setInputAction(() => emit('dragstart'), C.ScreenSpaceEventType.LEFT_DOWN);
  handler.setInputAction(() => emit('dragstart'), C.ScreenSpaceEventType.MIDDLE_DOWN);
  handler.setInputAction(() => emit('dragstart'), C.ScreenSpaceEventType.RIGHT_DOWN);

  let lastZoom = rangeToZoom(getCameraRange(viewer));
  viewer.camera.percentageChanged = 0.0008;
  viewer.camera.changed.addEventListener(() => {
    const z = rangeToZoom(getCameraRange(viewer));
    if (z !== lastZoom) {
      lastZoom = z;
      emit('zoom_changed');
    }
  });

  return {
    viewer,
    addListener(type, cb) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(cb);
      return {
        remove() {
          listeners[type] = (listeners[type] || []).filter(fn => fn !== cb);
        },
      };
    },
    panTo({ lat, lng }) {
      setCameraView(viewer, lat, lng, getCameraRange(viewer));
    },
    setZoom(z) {
      const c = getCameraCenter(viewer);
      setCameraView(viewer, c.lat, c.lon, zoomToRange(z));
    },
    getZoom() {
      return rangeToZoom(getCameraRange(viewer));
    },
    getCenter() {
      const c = getCameraCenter(viewer);
      return {
        lat: () => c.lat,
        lng: () => c.lon,
      };
    },
    getHeading() {
      return getHeadingDeg(viewer);
    },
    setHeading(deg) {
      const c = getCameraCenter(viewer);
      setCameraView(viewer, c.lat, c.lon, getCameraRange(viewer), deg);
    },
    setTilt(deg) {
      const c = getCameraCenter(viewer);
      setCameraView(viewer, c.lat, c.lon, getCameraRange(viewer), null, deg);
    },
    // Smooth globe spin using Cesium's camera.rotate (no jumps)
    rotateLon(stepDeg) {
      if (!viewer?.camera) return;
      viewer.camera.rotate(C.Cartesian3.UNIT_Z, C.Math.toRadians(stepDeg));
    },
  };
}

function bindMapEventHandlers(nextMap) {
  nextMap.addListener('click', async (ev) => {
    if (!ev?.latLng) return;
    await onMapPick(ev.latLng.lat(), ev.latLng.lng(), 'manual');
  });
  nextMap.addListener('zoom_changed', () => {
    stopRotation();
    clearTimeout(zoomRenderTimer);
    zoomRenderTimer = setTimeout(updateCityTierVisibility, 80);
  });
  nextMap.addListener('dragstart', stopRotation);
}

async function addBaseImageryLayer(C, viewer) {
  // Esri World Imagery — free satellite tiles (Google Earth-like appearance)
  let baseAdded = false;
  try {
    const provider = await C.ArcGisMapServerImageryProvider.fromUrl(
      'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
    );
    viewer.imageryLayers.addImageryProvider(provider, 0);
    baseAdded = true;
  } catch (_) {}
  if (!baseAdded) {
    // Fallback: NaturalEarthII bundled with Cesium
    try {
      const ne = await C.TileMapServiceImageryProvider.fromUrl(
        C.buildModuleUrl('Assets/Textures/NaturalEarthII')
      );
      viewer.imageryLayers.addImageryProvider(ne, 0);
      baseAdded = true;
    } catch (_) {}
  }
  if (!baseAdded) {
    // Last resort: public OpenStreetMap tiles (includes labels)
    viewer.imageryLayers.addImageryProvider(new C.UrlTemplateImageryProvider({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      credit: '(c) OpenStreetMap contributors',
      maximumLevel: 19,
    }), 0);
    return; // OSM already has labels, skip label overlay
  }
  // Add Esri labels overlay (city/village/road names — like Google Maps)
  try {
    const labels = await C.ArcGisMapServerImageryProvider.fromUrl(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer'
    );
    viewer.imageryLayers.addImageryProvider(labels);
  } catch (_) {}
}

function normalizeTileTemplateForClient(template) {
  const raw = (template || '').toString().trim();
  if (!raw) return raw;
  if (raw.startsWith('/')) return raw;
  try {
    const u = new URL(raw, window.location.href);
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
    if (!localHosts.has(u.hostname)) return u.toString();
    const pageHost = (window.location.hostname || '').trim();
    if (!pageHost || localHosts.has(pageHost)) return u.toString();
    u.hostname = pageHost;
    return u.toString();
  } catch (_) {
    return raw;
  }
}

function parseTileBoundsDegrees(raw) {
  const s = (raw || '').toString().trim();
  if (!s) return null;
  const parts = s.split(',').map(v => Number(v.trim()));
  if (parts.length !== 4 || parts.some(v => !Number.isFinite(v))) return null;
  const [west, south, east, north] = parts;
  if (west < -180 || west > 180 || east < -180 || east > 180) return null;
  if (south < -90 || south > 90 || north < -90 || north > 90) return null;
  if (east <= west || north <= south) return null;
  return { west, south, east, north };
}

function renderTemplateTileUrl(template, z = 0, x = 0, y = 0) {
  const maxIndex = (2 ** z) - 1;
  const reverseY = maxIndex - y;
  return template
    .replace(/\{z\}/g, String(z))
    .replace(/\{x\}/g, String(x))
    .replace(/\{y\}/g, String(y))
    .replace(/\{reverseY\}/g, String(reverseY))
    .replace(/\{s\}/g, 'a');
}

async function probeRootTile(template) {
  try {
    const u = renderTemplateTileUrl(template, 0, 0, 0);
    const res = await fetch(u, { method: 'GET', cache: 'no-store' });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: err };
  }
}

function initMap() {
  const container = document.getElementById('globe-container');
  container.innerHTML = '';
  const C = window.Cesium;
  const viewer = new C.Viewer(container, {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    terrainProvider: new C.EllipsoidTerrainProvider(),
    baseLayer: false,
  });
  // Dark base color prevents blue flash while satellite imagery loads
  viewer.scene.globe.baseColor = C.Color.fromCssColorString('#0a1628');
  // Satellite base layer (Esri World Imagery → NaturalEarthII → public OSM)
  addBaseImageryLayer(C, viewer);

  viewer.scene.globe.enableLighting = true;
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 2_000;
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = 40_000_000;
  viewer.scene.screenSpaceCameraController.enableTilt = true;

  map = createCesiumMapAdapter(viewer);
  bindMapEventHandlers(map);
  focusOn(HOME_VIEW.lat, HOME_VIEW.lon, HOME_VIEW.range);

  if (!mapContextMenuBound) {
    container.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    }, true);
    mapContextMenuBound = true;
  }

  setText('map-attrib', '3D globe by CesiumJS | Esri World Imagery');
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

async function geolocationPermissionState() {
  if (!navigator.permissions?.query) return 'unknown';
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status?.state || 'unknown';
  } catch (_) {
    return 'unknown';
  }
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

async function locateAndShowUserWeather({ force = false, animate = true, userInitiated = false } = {}) {
  try {
    const permissionState = await geolocationPermissionState();
    if (!userInitiated && permissionState !== 'granted') {
      return;
    }
    if (permissionState === 'denied') {
      flashHint('Location blocked by browser. Allow it in site settings (tune icon).', 5200);
      return;
    }

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
    // Save as ambient weather for persistent FX
    const w0 = data?.weather?.[0];
    ambientWeatherCode = Number.isFinite(Number(w0?.id)) ? Number(w0.id) : 800;
    ambientWeatherDay = isDaytime(data);
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

  if (homeBtn) homeBtn.addEventListener('click', () => {
    stopRotation();
    focusOn(HOME_VIEW.lat, HOME_VIEW.lon, HOME_VIEW.range);
    hidePanel();
  });

  if (locateBtn) locateBtn.addEventListener('click', async () => {
    await locateAndShowUserWeather({ force: true, animate: true, userInitiated: true });
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
      if (!map) return;
      e.preventDefault();
      stopRotation();
      const zoom = map.getZoom() ?? 2;
      const step = Math.max(0.05, 20 / (2 ** Math.max(0, zoom - 2)));
      const center = map.getCenter?.();
      if (!center) return;
      let lat = center.lat();
      let lon = center.lng();
      if      (e.key === 'ArrowLeft')  lon -= step;
      else if (e.key === 'ArrowRight') lon += step;
      else if (e.key === 'ArrowUp')    lat = Math.min(85, lat + step);
      else if (e.key === 'ArrowDown')  lat = Math.max(-85, lat - step);
      if (lon < -180) lon += 360;
      if (lon > 180) lon -= 360;
      map.panTo({ lat, lng: lon });
    }
  });
}

function initWeatherFX() {
  const canvas = document.getElementById('weather-canvas');
  if (!canvas) return;
  weatherFX = new WeatherFX(canvas);
  weatherFX.start();
}

async function main() {
  const loading = document.getElementById('loading-screen');
  const loaded = await ensureCesiumLoaded();
  if (!loaded || !window.Cesium?.Viewer) {
    if (loading) loading.classList.add('hidden');
    flashHint('CesiumJS failed to load. Check network and hard refresh (Ctrl+F5).', 7000);
    return;
  }

  await loadRuntimeConfig();
  initMap();
  initSearch();
  initControls();
  initWeatherFX();

  flashHint('Click anywhere on the 3D globe for weather', 5000);

  if (loading) loading.classList.add('hidden');

  locateAndShowUserWeather({ force: false, animate: true, userInitiated: false })
    .then(() => {
      // If ambient weather wasn't set (no geolocation), fetch for default location
      if (ambientWeatherCode == null) {
        fetchPointWeather(HOME_VIEW.lat, HOME_VIEW.lon, false).then(data => {
          const w0 = data?.weather?.[0];
          ambientWeatherCode = Number.isFinite(Number(w0?.id)) ? Number(w0.id) : 800;
          ambientWeatherDay = isDaytime(data);
          if (weatherFX && !activeMarkerData) {
            weatherFX.setWeather(ambientWeatherCode, ambientWeatherDay);
          }
        }).catch(() => {});
      }
    });
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
    // Hide UI elements for clean screensaver look
    document.querySelector('.topbar')?.classList.add('ss-hidden');
    document.querySelector('.controls')?.classList.add('ss-hidden');
    document.getElementById('hint')?.classList.add('ss-hidden');
    document.getElementById('map-attrib')?.classList.add('ss-hidden');
    // Close panel but keep/restore ambient weather FX during screensaver
    document.getElementById('weather-panel').classList.remove('active');
    clearActiveMarkers();
    activeMarkerData = null;
    activeTarget = null;
    renderCityMarkers(cityWeatherCache);
    if (weatherFX && ambientWeatherCode != null) {
      weatherFX.setWeather(ambientWeatherCode, ambientWeatherDay);
    }
    // Hide city markers for clean screensaver look
    for (const { bubble, icon } of cityPlacemarkMap.values()) {
      if (bubble?.setVisible) bubble.setVisible(false);
      if (icon?.setVisible) icon.setVisible(false);
    }
    // Zoom out for a full-globe spinning view
    focusOn(HOME_VIEW.lat, HOME_VIEW.lon, HOME_VIEW.range * 1.5);
    if (rotateTimer) stopRotation();
    clearTimeout(spinDelayTimer);
    spinDelayTimer = setTimeout(() => {
      if (!ss.classList.contains('active')) return;
      startRotation();
      screensaverStartedRotation = true;
    }, 600);
  }

  function dismissScreensaver() {
    ss.classList.remove('active');
    // Restore UI elements
    document.querySelector('.topbar')?.classList.remove('ss-hidden');
    document.querySelector('.controls')?.classList.remove('ss-hidden');
    document.getElementById('hint')?.classList.remove('ss-hidden');
    document.getElementById('map-attrib')?.classList.remove('ss-hidden');
    // Restore city markers
    updateCityTierVisibility();
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
