/*
  LocalWeather3D - weather animation anchored to the selected point on the globe.
  Uses lightweight THREE primitives to render sun/cloud/rain/snow/thunder/fog/wind.
*/

class LocalWeather3D {
  constructor(globe) {
    this.globe = globe;
    this.THREE = window.THREE;
    this.supported = !!(
      this.THREE
      && this.globe
      && typeof this.globe.scene === 'function'
      && typeof this.globe.getCoords === 'function'
    );

    this.root = null;
    this.baseGroup = null;
    this.effectGroup = null;
    this.effect = 'none';
    this._animators = [];
    this._raf = null;
    this._lastTs = 0;
    this._started = false;
    this._flashUntil = 0;
    this._nextFlashAt = 0;
    this._activePoint = null;

    if (this.supported) {
      this._up = new this.THREE.Vector3(0, 1, 0);
      this._normal = new this.THREE.Vector3();
      this._tmpQuat = new this.THREE.Quaternion();
    }
  }

  start() {
    if (!this.supported || this._started) return;
    this._started = true;
    this._ensureRoot();
    this._startLoop();
  }

  stop() {
    if (!this._started) return;
    this._started = false;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    this._clearEffect(true);
    if (this.root && this.root.parent) this.root.parent.remove(this.root);
    if (this.root) this._disposeObject(this.root);
    this.root = null;
    this.baseGroup = null;
    this.effectGroup = null;
    this.effect = 'none';
    this._animators = [];
    this._activePoint = null;
  }

  clear() {
    if (!this.supported) return;
    this._activePoint = null;
    this._clearEffect(false);
    if (this.root) this.root.visible = false;
  }

  setWeather({ lat, lon, owmCode, daytime = true }) {
    if (!this.supported) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    this._ensureRoot();
    this.root.visible = true;
    this._activePoint = { lat, lon };
    this._setAnchor(lat, lon);

    const next = LocalWeather3D._codeToEffect(Number(owmCode) || 800, !!daytime);
    if (next !== this.effect) {
      this._clearEffect(false);
      this.effect = next;
      this._buildEffect(next);
    }
  }

  _startLoop() {
    if (this._raf) return;
    this._lastTs = performance.now();
    const tick = (ts) => {
      this._tick(ts);
      if (this._started) this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  _tick(ts) {
    if (!this.root || !this._started) return;

    if (this._activePoint) this._setAnchor(this._activePoint.lat, this._activePoint.lon);

    const dt = Math.min(0.08, Math.max(0.001, (ts - this._lastTs) / 1000));
    this._lastTs = ts;
    const t = ts * 0.001;

    for (const fn of this._animators) fn(dt, t);
  }

  _ensureRoot() {
    if (this.root) return;
    const scene = this.globe.scene();
    const THREE = this.THREE;

    this.root = new THREE.Group();
    this.root.name = 'local-weather-root';
    this.root.visible = false;

    this.baseGroup = new THREE.Group();
    this.baseGroup.name = 'local-weather-base';
    this.root.add(this.baseGroup);

    this.effectGroup = new THREE.Group();
    this.effectGroup.name = 'local-weather-effect';
    this.root.add(this.effectGroup);

    this._buildBaseBeacon();
    scene.add(this.root);
  }

  _buildBaseBeacon() {
    const THREE = this.THREE;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.6, 10),
      new THREE.MeshBasicMaterial({
        color: 0x5ec8ff,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      }),
    );
    stem.position.y = 0.8;
    this.baseGroup.add(stem);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 20, 20),
      new THREE.MeshBasicMaterial({
        color: 0xbde7ff,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      }),
    );
    core.position.y = 1.62;
    this.baseGroup.add(core);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 20, 20),
      new THREE.MeshBasicMaterial({
        color: 0x67c8ff,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
      }),
    );
    halo.position.y = 1.62;
    this.baseGroup.add(halo);

    this._animators.push((_dt, t) => {
      const pulse = 0.88 + Math.sin(t * 3.3) * 0.1;
      halo.scale.setScalar(pulse);
      halo.material.opacity = 0.18 + (pulse - 0.88) * 0.5;
    });
  }

  _setAnchor(lat, lon) {
    if (!this.root) return;
    const p = this.globe.getCoords(lat, lon, 0.028);
    if (!p) return;

    this.root.position.set(p.x, p.y, p.z);
    this._normal.set(p.x, p.y, p.z).normalize();
    this._tmpQuat.setFromUnitVectors(this._up, this._normal);
    this.root.quaternion.copy(this._tmpQuat);
  }

  _clearEffect(resetEffectName) {
    if (!this.effectGroup) return;
    while (this.effectGroup.children.length) {
      const child = this.effectGroup.children.pop();
      this.effectGroup.remove(child);
      this._disposeObject(child);
    }

    this._animators = this._animators.slice(0, 1); // keep base beacon pulse
    this._flashUntil = 0;
    this._nextFlashAt = 0;
    if (resetEffectName) this.effect = 'none';
  }

  _disposeObject(obj) {
    obj.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
        else node.material.dispose();
      }
    });
  }

  _buildEffect(effect) {
    switch (effect) {
      case 'clear-day':
        this._buildClearDay();
        break;
      case 'clear-night':
        this._buildClearNight();
        break;
      case 'cloudy':
        this._buildClouds(false);
        break;
      case 'rain':
        this._buildRain(false);
        break;
      case 'thunder':
        this._buildRain(true);
        break;
      case 'snow':
        this._buildSnow();
        break;
      case 'fog':
        this._buildFog();
        break;
      case 'wind':
        this._buildWind();
        break;
      default:
        this._buildClouds(false);
        break;
    }
  }

  _buildClearDay() {
    const THREE = this.THREE;
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 28, 28),
      new THREE.MeshBasicMaterial({ color: 0xffe677 }),
    );
    sun.position.set(0, 6.1, 0);
    this.effectGroup.add(sun);

    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(1.9, 20, 20),
      new THREE.MeshBasicMaterial({
        color: 0xffcf4a,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );
    aura.position.copy(sun.position);
    this.effectGroup.add(aura);

    const rays = new THREE.Group();
    rays.position.copy(sun.position);
    this.effectGroup.add(rays);

    const rayGeo = new THREE.BoxGeometry(0.08, 1.25, 0.08);
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xffdf8a,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    for (let i = 0; i < 14; i++) {
      const ray = new THREE.Mesh(rayGeo, rayMat.clone());
      const ang = (i / 14) * Math.PI * 2;
      ray.position.set(Math.cos(ang) * 2.3, 0, Math.sin(ang) * 2.3);
      ray.lookAt(0, 0, 0);
      rays.add(ray);
    }

    this._animators.push((_dt, t) => {
      rays.rotation.y += 0.006;
      const pulse = 1 + Math.sin(t * 2.2) * 0.08;
      aura.scale.setScalar(pulse);
      aura.material.opacity = 0.22 + Math.sin(t * 2.2) * 0.05;
    });
  }

  _buildClearNight() {
    const THREE = this.THREE;
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(1.02, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xe9f0ff }),
    );
    moon.position.set(0, 5.8, 0);
    this.effectGroup.add(moon);

    const cut = new THREE.Mesh(
      new THREE.SphereGeometry(0.98, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0x3e4b76 }),
    );
    cut.position.set(0.38, 5.96, 0.22);
    this.effectGroup.add(cut);

    const stars = [];
    const starGeo = new THREE.SphereGeometry(0.07, 8, 8);
    for (let i = 0; i < 22; i++) {
      const star = new THREE.Mesh(
        starGeo,
        new THREE.MeshBasicMaterial({
          color: 0xe8f4ff,
          transparent: true,
          opacity: 0.5 + Math.random() * 0.4,
          depthWrite: false,
        }),
      );
      star.position.set((Math.random() - 0.5) * 7.2, 4.8 + Math.random() * 3.3, (Math.random() - 0.5) * 5.6);
      this.effectGroup.add(star);
      stars.push(star);
    }

    this._animators.push((_dt, t) => {
      stars.forEach((s, i) => {
        s.material.opacity = 0.28 + Math.abs(Math.sin(t * 1.5 + i * 0.8)) * 0.65;
      });
    });
  }

  _buildClouds(dark) {
    const cloud = this._createCloud({
      y: 5.1,
      scale: 1.1,
      color: dark ? 0x8a94ab : 0xdce6f4,
      opacity: dark ? 0.9 : 0.84,
    });
    this.effectGroup.add(cloud);

    this._animators.push((_dt, t) => {
      cloud.position.x = Math.sin(t * 0.65) * 0.45;
      cloud.position.z = Math.cos(t * 0.72) * 0.28;
    });
  }

  _createCloud({ y, scale, color, opacity }) {
    const THREE = this.THREE;
    const cloud = new THREE.Group();
    const puffs = [
      { x: -1.4, z: -0.1, r: 1.0 },
      { x: -0.5, z: 0.5, r: 1.25 },
      { x: 0.45, z: 0.05, r: 1.42 },
      { x: 1.35, z: -0.25, r: 1.05 },
      { x: 0.05, z: -0.72, r: 1.18 },
    ];
    for (const p of puffs) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(p.r, 20, 20),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false,
        }),
      );
      puff.position.set(p.x, y + (Math.random() - 0.5) * 0.2, p.z);
      cloud.add(puff);
    }
    cloud.scale.setScalar(scale);
    return cloud;
  }

  _buildRain(withThunder) {
    const THREE = this.THREE;
    const cloud = this._createCloud({
      y: 5.2,
      scale: 1.2,
      color: withThunder ? 0x6f7c96 : 0xafbfd7,
      opacity: 0.88,
    });
    this.effectGroup.add(cloud);

    const drops = [];
    const dropGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.85, 6);
    for (let i = 0; i < 70; i++) {
      const drop = new THREE.Mesh(
        dropGeo,
        new THREE.MeshBasicMaterial({
          color: 0x9ecfff,
          transparent: true,
          opacity: 0.74,
          depthWrite: false,
        }),
      );
      drop.rotation.z = 0.32;
      this.effectGroup.add(drop);
      drops.push({
        mesh: drop,
        speed: 6.2 + Math.random() * 3.8,
        x: (Math.random() - 0.5) * 4.8,
        z: (Math.random() - 0.5) * 3.8,
        y: 0.4 + Math.random() * 4.1,
      });
    }

    let bolt = null;
    if (withThunder) {
      const pts = [
        new THREE.Vector3(0.2, 4.8, 0),
        new THREE.Vector3(-0.25, 3.6, 0.12),
        new THREE.Vector3(0.15, 2.75, -0.08),
        new THREE.Vector3(-0.18, 1.75, 0.06),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: 0xe7f5ff,
        transparent: true,
        opacity: 0,
      });
      bolt = new THREE.Line(geo, mat);
      this.effectGroup.add(bolt);
      this._nextFlashAt = performance.now() + 1400 + Math.random() * 2600;
      this._flashUntil = 0;
    }

    this._animators.push((dt) => {
      cloud.position.x += dt * 0.3;
      if (cloud.position.x > 0.55) cloud.position.x = -0.55;

      for (const d of drops) {
        d.y -= d.speed * dt;
        if (d.y < 0) d.y = 4 + Math.random() * 1.6;
        d.mesh.position.set(d.x, d.y + 1.0, d.z);
      }

      if (!bolt) return;
      const now = performance.now();
      if (now > this._nextFlashAt) {
        this._flashUntil = now + 120 + Math.random() * 120;
        this._nextFlashAt = now + 1800 + Math.random() * 3200;
      }
      bolt.material.opacity = now < this._flashUntil ? 0.98 : 0;
    });
  }

  _buildSnow() {
    const THREE = this.THREE;
    const cloud = this._createCloud({
      y: 5.2,
      scale: 1.08,
      color: 0xcfd9eb,
      opacity: 0.86,
    });
    this.effectGroup.add(cloud);

    const flakes = [];
    const flakeGeo = new THREE.SphereGeometry(0.07, 8, 8);
    for (let i = 0; i < 58; i++) {
      const flake = new THREE.Mesh(
        flakeGeo,
        new THREE.MeshBasicMaterial({
          color: 0xf7fbff,
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        }),
      );
      this.effectGroup.add(flake);
      flakes.push({
        mesh: flake,
        speed: 1.5 + Math.random() * 1.1,
        drift: (Math.random() - 0.5) * 0.55,
        wave: Math.random() * Math.PI * 2,
        x: (Math.random() - 0.5) * 5,
        z: (Math.random() - 0.5) * 4,
        y: 0.5 + Math.random() * 4.6,
      });
    }

    this._animators.push((dt) => {
      for (const f of flakes) {
        f.wave += dt * 2.1;
        f.y -= f.speed * dt;
        if (f.y < 0) f.y = 4.8 + Math.random() * 1.5;
        f.mesh.position.set(f.x + Math.sin(f.wave) * f.drift, f.y + 1.0, f.z);
      }
    });
  }

  _buildFog() {
    const THREE = this.THREE;
    const rings = [];
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.2 + i * 0.45, 0.1, 12, 42),
        new THREE.MeshBasicMaterial({
          color: 0xc7d3e3,
          transparent: true,
          opacity: 0.2 - i * 0.03,
          depthWrite: false,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 2.5 + i * 0.32;
      this.effectGroup.add(ring);
      rings.push(ring);
    }
    this._animators.push((_dt, t) => {
      rings.forEach((r, i) => {
        r.rotation.z = t * (0.08 + i * 0.03);
        r.position.x = Math.sin(t * 0.35 + i * 1.3) * 0.25;
      });
    });
  }

  _buildWind() {
    const THREE = this.THREE;
    const cloud = this._createCloud({
      y: 5.0,
      scale: 0.95,
      color: 0xd5e0ef,
      opacity: 0.76,
    });
    this.effectGroup.add(cloud);

    const streaks = [];
    const streakGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.5, 6);
    for (let i = 0; i < 18; i++) {
      const streak = new THREE.Mesh(
        streakGeo,
        new THREE.MeshBasicMaterial({
          color: 0xbfdcff,
          transparent: true,
          opacity: 0.52,
          depthWrite: false,
        }),
      );
      streak.rotation.z = Math.PI / 2;
      this.effectGroup.add(streak);
      streaks.push({
        mesh: streak,
        x: -3.5 - Math.random() * 2.2,
        y: 1.2 + Math.random() * 3.5,
        z: (Math.random() - 0.5) * 3.5,
        speed: 3.8 + Math.random() * 2.1,
      });
    }

    this._animators.push((dt) => {
      cloud.position.x = Math.sin(performance.now() * 0.001) * 0.32;
      for (const s of streaks) {
        s.x += s.speed * dt;
        if (s.x > 3.8) s.x = -3.8 - Math.random() * 1.8;
        s.mesh.position.set(s.x, s.y, s.z);
      }
    });
  }

  static _codeToEffect(code, daytime) {
    if (code >= 200 && code <= 232) return 'thunder';
    if (code >= 300 && code <= 531) return 'rain';
    if (code >= 600 && code <= 622) return 'snow';
    if ([701, 711, 721, 731, 741, 751, 761, 762].includes(code)) return 'fog';
    if (code === 771 || code === 781) return 'wind';
    if (code === 800) return daytime ? 'clear-day' : 'clear-night';
    if (code >= 801 && code <= 804) return 'cloudy';
    return 'cloudy';
  }
}

window.LocalWeather3D = LocalWeather3D;
