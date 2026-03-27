/*
  WeatherFX - full-screen animated weather overlay
  Usage:
    const fx = new WeatherFX(document.getElementById('weather-canvas'));
    fx.start();
    fx.setWeather(800, true); // OpenWeather code + daytime
    fx.clear();
*/

// # QUICK GUIDE
// # This class draws weather particles and atmospheric layers on a canvas.
// # It maps OpenWeather condition codes to many distinct visual effects.
// # The app calls setWeather(code, isDaytime) with real data from the API.
class WeatherFX {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.effect = 'none';
    this.alpha = 0;
    this.target = 0;
    this.particles = [];
    this._clouds = null;
    this._raf = null;
    this._nextFlash = 0;
    this._nextTarget = 1;

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  start() {
    if (this._raf) return;
    const loop = ts => {
      this._draw(ts);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  // Feed any weather condition code (200-804) + day/night hint.
  setWeather(owmCode, daytime = true) {
    const next = WeatherFX._codeToEffect(owmCode, daytime);
    const nextTarget = WeatherFX._effectIntensity(next);
    if (next === this.effect && Math.abs(this.target - nextTarget) < 0.01) return;

    this.target = 0;
    const swap = () => {
      this.effect = next;
      this._initEffect(next);
      this.target = nextTarget;
      this._nextTarget = nextTarget;
    };

    if (this.alpha < 0.05) swap();
    else setTimeout(swap, 460);
  }

  static _effectIntensity(effect) {
    return {
      'thunder-heavy-rain': 0.62,
      thunderstorm: 0.56,
      'thunder-drizzle': 0.48,
      drizzle: 0.34,
      'light-rain': 0.39,
      rain: 0.46,
      'heavy-rain': 0.54,
      showers: 0.5,
      'freezing-rain': 0.5,
      sleet: 0.47,
      'light-snow': 0.38,
      snow: 0.43,
      'heavy-snow': 0.5,
      'snow-showers': 0.45,
      mist: 0.32,
      haze: 0.3,
      dust: 0.34,
      windy: 0.36,
      'clear-day': 0.3,
      'clear-night': 0.26,
      'few-clouds-day': 0.3,
      'few-clouds-night': 0.28,
      'scattered-clouds': 0.32,
      'broken-clouds': 0.36,
      overcast: 0.4,
    }[effect] ?? 0.36;
  }

  clear() {
    this.target = 0;
    setTimeout(() => {
      this.effect = 'none';
      this.particles = [];
    }, 750);
  }

  static _codeToEffect(code, daytime) {
    if (code >= 200 && code <= 202) return 'thunder-heavy-rain';
    if (code >= 210 && code <= 221) return 'thunderstorm';
    if (code >= 230 && code <= 232) return 'thunder-drizzle';

    if (code >= 300 && code <= 321) return 'drizzle';

    if (code === 500) return 'light-rain';
    if (code === 501) return 'rain';
    if (code >= 502 && code <= 504) return 'heavy-rain';
    if (code === 511) return 'freezing-rain';
    if (code >= 520 && code <= 531) return 'showers';

    if (code === 600) return 'light-snow';
    if (code === 601) return 'snow';
    if (code === 602 || code === 622) return 'heavy-snow';
    if ([611, 612, 613, 615, 616].includes(code)) return 'sleet';
    if (code === 620 || code === 621) return 'snow-showers';

    if (code === 701 || code === 741) return 'mist';
    if (code === 721) return 'haze';
    if ([711, 731, 751, 761, 762].includes(code)) return 'dust';
    if (code === 771 || code === 781) return 'windy';

    if (code === 800) return daytime ? 'clear-day' : 'clear-night';
    if (code === 801) return daytime ? 'few-clouds-day' : 'few-clouds-night';
    if (code === 802) return 'scattered-clouds';
    if (code === 803) return 'broken-clouds';
    if (code === 804) return 'overcast';

    return daytime ? 'clear-day' : 'clear-night';
  }

  _initEffect(effect) {
    this.particles = [];
    this._clouds = null;
    this._nextFlash = Date.now() + 1700 + Math.random() * 2200;

    const rainSet = new Set([
      'thunder-heavy-rain',
      'thunderstorm',
      'thunder-drizzle',
      'light-rain',
      'rain',
      'heavy-rain',
      'showers',
      'freezing-rain',
      'drizzle',
      'sleet',
    ]);

    const snowSet = new Set([
      'light-snow',
      'snow',
      'heavy-snow',
      'snow-showers',
    ]);

    const counts = {
      'thunder-heavy-rain': 240,
      thunderstorm: 190,
      'thunder-drizzle': 130,
      drizzle: 85,
      'light-rain': 95,
      rain: 130,
      'heavy-rain': 185,
      showers: 145,
      'freezing-rain': 155,
      sleet: 135,
      'light-snow': 70,
      snow: 95,
      'heavy-snow': 140,
      'snow-showers': 110,
    };

    const n = counts[effect] || 0;
    for (let i = 0; i < n; i++) {
      if (rainSet.has(effect)) this.particles.push(this._newDrop(effect, true));
      else if (snowSet.has(effect)) this.particles.push(this._newFlake(effect, true));
    }
  }

  _newDrop(effect = 'rain', scatter = false) {
    const cfg = {
      'thunder-heavy-rain': { spdMin: 19, spdMax: 29, lenMin: 15, lenMax: 24, alphaMin: 0.28, alphaMax: 0.48, wind: 0.17 },
      thunderstorm: { spdMin: 17, spdMax: 25, lenMin: 12, lenMax: 20, alphaMin: 0.24, alphaMax: 0.43, wind: 0.15 },
      'thunder-drizzle': { spdMin: 12, spdMax: 19, lenMin: 8, lenMax: 14, alphaMin: 0.2, alphaMax: 0.36, wind: 0.12 },
      drizzle: { spdMin: 8, spdMax: 13, lenMin: 6, lenMax: 10, alphaMin: 0.14, alphaMax: 0.3, wind: 0.1 },
      'light-rain': { spdMin: 9, spdMax: 15, lenMin: 8, lenMax: 13, alphaMin: 0.16, alphaMax: 0.32, wind: 0.11 },
      rain: { spdMin: 11, spdMax: 18, lenMin: 9, lenMax: 16, alphaMin: 0.18, alphaMax: 0.36, wind: 0.12 },
      'heavy-rain': { spdMin: 15, spdMax: 24, lenMin: 12, lenMax: 20, alphaMin: 0.23, alphaMax: 0.44, wind: 0.14 },
      showers: { spdMin: 12, spdMax: 22, lenMin: 9, lenMax: 16, alphaMin: 0.2, alphaMax: 0.4, wind: 0.13 },
      'freezing-rain': { spdMin: 11, spdMax: 20, lenMin: 10, lenMax: 16, alphaMin: 0.2, alphaMax: 0.4, wind: 0.12 },
      sleet: { spdMin: 12, spdMax: 19, lenMin: 6, lenMax: 10, alphaMin: 0.26, alphaMax: 0.45, wind: 0.1 },
    }[effect] || { spdMin: 11, spdMax: 18, lenMin: 9, lenMax: 16, alphaMin: 0.18, alphaMax: 0.36, wind: 0.12 };

    const spd = cfg.spdMin + Math.random() * (cfg.spdMax - cfg.spdMin);
    return {
      kind: 'drop',
      effect,
      x: Math.random() * this.W,
      y: scatter ? Math.random() * this.H : -25,
      vx: spd * cfg.wind,
      vy: spd,
      len: cfg.lenMin + Math.random() * (cfg.lenMax - cfg.lenMin),
      a: cfg.alphaMin + Math.random() * (cfg.alphaMax - cfg.alphaMin),
    };
  }

  _newFlake(effect = 'snow', scatter = false) {
    const cfg = {
      'light-snow': { vyMin: 0.35, vyMax: 1.0, rMin: 1.2, rMax: 2.8, alphaMin: 0.38, alphaMax: 0.72, drift: 0.55 },
      snow: { vyMin: 0.45, vyMax: 1.3, rMin: 1.5, rMax: 3.4, alphaMin: 0.45, alphaMax: 0.82, drift: 0.7 },
      'heavy-snow': { vyMin: 0.55, vyMax: 1.8, rMin: 1.8, rMax: 4.2, alphaMin: 0.52, alphaMax: 0.92, drift: 0.85 },
      'snow-showers': { vyMin: 0.55, vyMax: 1.5, rMin: 1.4, rMax: 3.2, alphaMin: 0.45, alphaMax: 0.82, drift: 0.65 },
    }[effect] || { vyMin: 0.45, vyMax: 1.3, rMin: 1.5, rMax: 3.4, alphaMin: 0.45, alphaMax: 0.82, drift: 0.7 };

    return {
      kind: 'flake',
      effect,
      x: Math.random() * this.W,
      y: scatter ? Math.random() * this.H : -12,
      vx: (Math.random() - 0.5) * cfg.drift,
      vy: cfg.vyMin + Math.random() * (cfg.vyMax - cfg.vyMin),
      r: cfg.rMin + Math.random() * (cfg.rMax - cfg.rMin),
      a: cfg.alphaMin + Math.random() * (cfg.alphaMax - cfg.alphaMin),
      wb: Math.random() * Math.PI * 2,
      ws: 0.012 + Math.random() * 0.028,
    };
  }

  _getClouds(n) {
    if (!this._clouds || this._clouds.length !== n) {
      this._clouds = Array.from({ length: n }, (_, i) => ({
        x: (i / n) * this.W + Math.random() * (this.W / n),
        y: this.H * (0.04 + Math.random() * 0.22),
        spd: 0.05 + Math.random() * 0.11,
        rx: 120 + Math.random() * 100,
        ry: 40 + Math.random() * 38,
      }));
    }
    return this._clouds;
  }

  _draw(ts) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    const step = 0.024;
    if (this.alpha < this.target) this.alpha = Math.min(this.target, this.alpha + step);
    else if (this.alpha > this.target) this.alpha = Math.max(this.target, this.alpha - step);

    if (this.alpha < 0.01 || this.effect === 'none') return;

    const a = this.alpha;
    switch (this.effect) {
      case 'thunder-heavy-rain': this._drawStorm(ctx, ts, a, 'thunder-heavy-rain'); break;
      case 'thunderstorm': this._drawStorm(ctx, ts, a, 'thunderstorm'); break;
      case 'thunder-drizzle': this._drawStorm(ctx, ts, a, 'thunder-drizzle'); break;
      case 'drizzle': this._drawDrizzle(ctx, a); break;
      case 'light-rain': this._drawRain(ctx, a, 'light-rain'); break;
      case 'rain': this._drawRain(ctx, a, 'rain'); break;
      case 'heavy-rain': this._drawRain(ctx, a, 'heavy-rain'); break;
      case 'showers': this._drawRain(ctx, a, 'showers'); break;
      case 'freezing-rain': this._drawRain(ctx, a, 'freezing-rain'); break;
      case 'sleet': this._drawSleet(ctx, a); break;
      case 'light-snow': this._drawSnow(ctx, a, 'light-snow'); break;
      case 'snow': this._drawSnow(ctx, a, 'snow'); break;
      case 'heavy-snow': this._drawSnow(ctx, a, 'heavy-snow'); break;
      case 'snow-showers': this._drawSnow(ctx, a, 'snow-showers'); break;
      case 'mist': this._drawFog(ctx, ts, a, 'mist'); break;
      case 'haze': this._drawFog(ctx, ts, a, 'haze'); break;
      case 'dust': this._drawFog(ctx, ts, a, 'dust'); break;
      case 'windy': this._drawWindy(ctx, ts, a); break;
      case 'clear-day': this._drawSunny(ctx, ts, a, false); break;
      case 'clear-night': this._drawNightClear(ctx, ts, a); break;
      case 'few-clouds-day': this._drawPartly(ctx, ts, a, false); break;
      case 'few-clouds-night': this._drawPartly(ctx, ts, a, true); break;
      case 'scattered-clouds': this._drawCloudy(ctx, ts, a, 'scattered'); break;
      case 'broken-clouds': this._drawCloudy(ctx, ts, a, 'broken'); break;
      case 'overcast': this._drawCloudy(ctx, ts, a, 'overcast'); break;
      default: this._drawCloudy(ctx, ts, a, 'scattered'); break;
    }
  }

  _drawRain(ctx, a, effect = 'rain') {
    const style = {
      'light-rain': { base: 'rgba(180,220,255,', lw: 0.65, tilt: 0.45 },
      rain: { base: 'rgba(165,205,255,', lw: 0.85, tilt: 0.5 },
      'heavy-rain': { base: 'rgba(130,185,255,', lw: 1.2, tilt: 0.52 },
      showers: { base: 'rgba(150,200,255,', lw: 1.0, tilt: 0.5 },
      'freezing-rain': { base: 'rgba(190,235,255,', lw: 0.95, tilt: 0.45 },
      'thunder-heavy-rain': { base: 'rgba(125,178,255,', lw: 1.3, tilt: 0.54 },
      thunderstorm: { base: 'rgba(135,188,255,', lw: 1.15, tilt: 0.52 },
      'thunder-drizzle': { base: 'rgba(155,205,255,', lw: 0.85, tilt: 0.45 },
      drizzle: { base: 'rgba(185,215,255,', lw: 0.6, tilt: 0.35 },
    }[effect] || { base: 'rgba(165,205,255,', lw: 0.85, tilt: 0.5 };

    ctx.save();
    ctx.lineCap = 'round';
    for (const p of this.particles) {
      ctx.strokeStyle = `${style.base}${p.a * a})`;
      ctx.lineWidth = style.lw;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * style.tilt, p.y + p.len);
      ctx.stroke();

      let gust = 1;
      if (effect === 'showers') {
        gust = 0.75 + Math.sin((p.x + p.y + performance.now() * 0.006) * 0.08) * 0.35;
      }

      p.x += p.vx * gust;
      p.y += p.vy * gust;

      if (p.y > this.H + p.len) Object.assign(p, this._newDrop(effect));
      if (p.x > this.W + 10) p.x = -10;
      if (p.x < -10) p.x = this.W + 10;
    }
    ctx.restore();
  }

  _drawDrizzle(ctx, a) {
    this._drawRain(ctx, a, 'drizzle');
  }

  _drawStorm(ctx, ts, a, effect) {
    const dark = {
      'thunder-heavy-rain': 0.46,
      thunderstorm: 0.38,
      'thunder-drizzle': 0.28,
    }[effect] || 0.35;

    const vg = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.08, this.W / 2, this.H / 2, this.H * 0.95);
    vg.addColorStop(0, 'rgba(5,10,24,0)');
    vg.addColorStop(1, `rgba(5,10,24,${dark * a})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.W, this.H);

    this._drawRain(ctx, a, effect);

    if (Date.now() > this._nextFlash) {
      const intensity = effect === 'thunder-heavy-rain' ? 1.15 : effect === 'thunder-drizzle' ? 0.65 : 0.9;
      this._lightning(ctx, a, intensity);
      const gap = effect === 'thunder-heavy-rain' ? 1800 : effect === 'thunder-drizzle' ? 3200 : 2500;
      this._nextFlash = Date.now() + gap + Math.random() * 4200;
    }
  }

  _lightning(ctx, a, intensity = 1) {
    ctx.save();
    ctx.fillStyle = `rgba(205,230,255,${0.12 * a * intensity})`;
    ctx.fillRect(0, 0, this.W, this.H);

    const bx = this.W * (0.2 + Math.random() * 0.6);
    ctx.strokeStyle = `rgba(226,240,255,${0.78 * a * intensity})`;
    ctx.lineWidth = 1.4 + 0.5 * intensity;
    ctx.shadowBlur = 13 * intensity;
    ctx.shadowColor = 'rgba(160,205,255,0.9)';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let x = bx;
    let y = 0;
    ctx.moveTo(x, y);
    while (y < this.H * (0.52 + Math.random() * 0.14)) {
      x += (Math.random() - 0.5) * (62 + intensity * 18);
      y += 24 + Math.random() * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawSnow(ctx, a, effect = 'snow') {
    const glow = {
      'light-snow': 3,
      snow: 5,
      'heavy-snow': 7,
      'snow-showers': 5,
    }[effect] || 5;

    ctx.save();
    for (const p of this.particles) {
      p.wb += p.ws;
      p.x += p.vx + Math.sin(p.wb) * 0.35;
      p.y += p.vy;
      if (p.y > this.H + p.r * 2) Object.assign(p, this._newFlake(effect));
      if (p.x < -p.r) p.x = this.W + p.r;
      if (p.x > this.W + p.r) p.x = -p.r;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(228,238,255,${p.a * a})`;
      ctx.shadowBlur = glow;
      ctx.shadowColor = 'rgba(200,220,255,0.55)';
      ctx.fill();
    }
    ctx.restore();
  }

  _drawSleet(ctx, a) {
    ctx.save();
    ctx.lineCap = 'round';
    for (const p of this.particles) {
      ctx.strokeStyle = `rgba(210,230,255,${p.a * a})`;
      ctx.lineWidth = 0.95;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 0.35, p.y + p.len * 0.85);
      ctx.stroke();

      ctx.fillStyle = `rgba(240,246,255,${0.45 * p.a * a})`;
      ctx.beginPath();
      ctx.arc(p.x + p.vx * 0.35, p.y + p.len * 0.85, 0.9, 0, Math.PI * 2);
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;
      if (p.y > this.H + p.len) Object.assign(p, this._newDrop('sleet'));
      if (p.x > this.W + 10) p.x = -10;
      if (p.x < -10) p.x = this.W + 10;
    }
    ctx.restore();
  }

  _drawSunny(ctx, ts, a, muted) {
    const cx = this.W * 0.78;
    const cy = this.H * 0.14;
    const t = ts * 0.001;
    const glowScale = muted ? 0.65 : 1;

    const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 420);
    g1.addColorStop(0, `rgba(255,215,55,${0.22 * a * glowScale})`);
    g1.addColorStop(0.45, `rgba(255,175,30,${0.09 * a * glowScale})`);
    g1.addColorStop(1, 'rgba(255,155,0,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.1);
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const r0 = 24;
      const r1 = 86 + (i % 3) * 52;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * r0, Math.sin(angle) * r0);
      ctx.lineTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
      ctx.strokeStyle = `rgba(255,225,75,${0.08 * a * glowScale})`;
      ctx.lineWidth = 3 + (i % 2) * 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();

    const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 58);
    g2.addColorStop(0, `rgba(255,255,205,${0.52 * a * glowScale})`);
    g2.addColorStop(0.4, `rgba(255,232,80,${0.22 * a * glowScale})`);
    g2.addColorStop(1, 'rgba(255,210,40,0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(cx, cy, 58, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawNightClear(ctx, ts, a) {
    const cx = this.W * 0.76;
    const cy = this.H * 0.14;
    const t = ts * 0.001;

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 300);
    g.addColorStop(0, `rgba(200,220,255,${0.18 * a})`);
    g.addColorStop(0.5, `rgba(140,170,235,${0.08 * a})`);
    g.addColorStop(1, 'rgba(80,110,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    // Moon crescent
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(240,245,255,${0.42 * a})`;
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(11, -4, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Twinkling stars
    ctx.save();
    for (let i = 0; i < 42; i++) {
      const sx = (i * 163) % this.W;
      const sy = 12 + ((i * 97) % Math.max(60, this.H * 0.45));
      const tw = 0.25 + 0.75 * Math.abs(Math.sin(t * 1.2 + i * 0.9));
      ctx.fillStyle = `rgba(220,235,255,${0.26 * a * tw})`;
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
    ctx.restore();
  }

  _drawPartly(ctx, ts, a, night) {
    if (night) this._drawNightClear(ctx, ts, a * 0.9);
    else this._drawSunny(ctx, ts, a, true);
    this._drawCloudLayer(ctx, a, 3, 0.18, 1);
  }

  _drawCloudy(ctx, ts, a, density) {
    if (density === 'scattered') this._drawCloudLayer(ctx, a, 4, 0.2, 1);
    else if (density === 'broken') this._drawCloudLayer(ctx, a, 6, 0.28, 1.05);
    else this._drawCloudLayer(ctx, a, 8, 0.34, 1.12);

    if (density === 'overcast') {
      ctx.fillStyle = `rgba(105,125,155,${0.16 * a})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  _drawCloudLayer(ctx, a, count, opacity, speedScale) {
    const clouds = this._getClouds(count);
    for (const c of clouds) {
      c.x += c.spd * speedScale;
      if (c.x > this.W + c.rx + 60) c.x = -c.rx - 60;

      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.rx);
      g.addColorStop(0, `rgba(195,208,228,${opacity * a})`);
      g.addColorStop(0.55, `rgba(208,218,232,${opacity * 0.45 * a})`);
      g.addColorStop(1, 'rgba(210,218,232,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawFog(ctx, ts, a, kind) {
    const cfg = {
      mist: { r: 195, g: 210, b: 222, bands: 4, amp: 55, base: 0.08, step: 0.022, spread: 95 },
      haze: { r: 215, g: 205, b: 180, bands: 3, amp: 34, base: 0.065, step: 0.018, spread: 100 },
      dust: { r: 206, g: 176, b: 132, bands: 4, amp: 26, base: 0.075, step: 0.02, spread: 90 },
    }[kind] || { r: 195, g: 210, b: 222, bands: 4, amp: 50, base: 0.08, step: 0.02, spread: 95 };

    const t = ts * 0.00008;
    for (let i = 0; i < cfg.bands; i++) {
      const y = this.H * (0.12 + i * 0.22);
      const dx = Math.sin(t + i * 1.7) * cfg.amp;
      const op = (cfg.base + i * cfg.step) * a;
      const g = ctx.createLinearGradient(0, y - cfg.spread, 0, y + cfg.spread);
      g.addColorStop(0, `rgba(${cfg.r},${cfg.g},${cfg.b},0)`);
      g.addColorStop(0.5, `rgba(${cfg.r},${cfg.g},${cfg.b},${op})`);
      g.addColorStop(1, `rgba(${cfg.r},${cfg.g},${cfg.b},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(dx, y - cfg.spread, this.W + cfg.amp * 2, cfg.spread * 2);
    }
  }

  _drawWindy(ctx, ts, a) {
    this._drawCloudLayer(ctx, a, 4, 0.2, 1.45);

    const t = ts * 0.001;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const y = (i * 47 + Math.sin(t + i) * 18) % this.H;
      const x = ((t * 300 + i * 170) % (this.W + 240)) - 120;
      const len = 70 + (i % 5) * 18;
      const fade = 0.04 + ((i % 4) * 0.012);
      ctx.strokeStyle = `rgba(210,225,245,${fade * a})`;
      ctx.lineWidth = 1 + (i % 2) * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y - 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  _resize() {
    this.W = this.canvas.width = window.innerWidth;
    this.H = this.canvas.height = window.innerHeight;
    this._clouds = null;
  }
}
