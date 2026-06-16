/* Alfred Hub — shared client logic v2.
   Live data: pages fetch() canonical repo files (same-origin, Access-gated) via Hub.fetchData.
   Writes go through the Worker API (/api/*) which commits to the repo — git is the one brain.
   localStorage remains ONLY for local UI prefs + the legacy feedback box. */
(function (global) {
  const KEY = 'alfredHubState_v1';

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(state) { state.updated = new Date().toISOString(); localStorage.setItem(KEY, JSON.stringify(state)); }
  function patch(fn) { const s = load(); fn(s); save(s); return s; }

  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---- Live data: fetch a repo file with cache-bust; null on failure (caller renders fallback) ---- */
  async function fetchData(path) {
    try {
      const r = await fetch(path + (path.includes('?') ? '&' : '?') + 't=' + Date.now());
      if (!r.ok) return null;
      const ct = r.headers.get('content-type') || '';
      return (ct.includes('json') || path.endsWith('.json')) ? await r.json() : await r.text();
    } catch (e) { return null; }
  }

  /* ---- Worker API: POST a write action. Returns {ok,...} or {ok:false,error} ---- */
  async function api(path, body) {
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, status: r.status, ...j };
      return { ok: true, ...j };
    } catch (e) { return { ok: false, error: String(e) }; }
  }

  /* ---- Formatting ---- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function relTime(iso) {
    if (!iso) return '';
    const d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
    if (isNaN(s)) return iso;
    if (s < 90) return 'just now';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    if (s < 86400 * 7) return Math.round(s / 86400) + 'd ago';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function fmtDate(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }

  function exportState() {
    const blob = new Blob([JSON.stringify(load(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'alfred-hub-state.json'; a.click();
    URL.revokeObjectURL(a.href);
    toast('Exported.');
  }
  function importState(file, after) {
    const r = new FileReader();
    r.onload = () => { try { save(JSON.parse(r.result)); toast('Imported.'); after && after(); }
      catch (e) { toast('Could not read that file.'); } };
    r.readAsText(file);
  }
  function addFeedback(section, text) {
    if (!text || !text.trim()) return;
    patch(s => { (s.feedback = s.feedback || []).push({ section, text: text.trim(), ts: new Date().toISOString() }); });
    toast('Noted.');
  }

  // Top-nav: active highlight + mobile hamburger
  function initNav() {
    const here = (location.pathname.split('/').pop() || 'index.html');
    document.querySelectorAll('.topnav a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === here || (here === '' && href === 'index.html')) a.classList.add('active');
    });
    const btn = document.querySelector('.menu-btn'), nav = document.querySelector('.topnav');
    if (btn && nav) btn.addEventListener('click', () => nav.classList.toggle('open'));
  }

  // Reusable carousel: advances by one slide; loops; autoplay; dots.
  function carousel(rootSel, opts) {
    const root = document.querySelector(rootSel); if (!root) return;
    const track = root.querySelector('.track');
    const slides = Array.from(track.children);
    if (!slides.length) return;
    const dotsWrap = root.querySelector('.dots');
    const per = () => (window.innerWidth <= 820 ? 1 : (opts && opts.per) || 3);
    let i = 0;
    function maxIndex() { return Math.max(0, slides.length - per()); }
    function go(n) {
      i = Math.max(0, Math.min(n, maxIndex()));
      const slideW = slides[0].getBoundingClientRect().width + 16;
      track.style.transform = `translateX(${-i * slideW}px)`;
      if (dotsWrap) Array.from(dotsWrap.children).forEach((d, k) => d.classList.toggle('on', k === i));
    }
    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      for (let k = 0; k <= maxIndex(); k++) { const d = document.createElement('i'); d.onclick = () => go(k); dotsWrap.appendChild(d); }
    }
    const prev = root.querySelector('[data-car=prev]'), next = root.querySelector('[data-car=next]');
    if (prev) prev.onclick = () => go(i <= 0 ? maxIndex() : i - 1);
    if (next) next.onclick = () => go(i >= maxIndex() ? 0 : i + 1);
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      let timer = setInterval(() => go(i >= maxIndex() ? 0 : i + 1), (opts && opts.interval) || 5000);
      root.addEventListener('mouseenter', () => clearInterval(timer));
      root.addEventListener('mouseleave', () => timer = setInterval(() => go(i >= maxIndex() ? 0 : i + 1), (opts && opts.interval) || 5000));
    }
    window.addEventListener('resize', () => go(i));
    go(0);
  }

  // Pointer-tracking glow for tiles (sets --mx for the radial highlight)
  function initTileGlow() {
    document.querySelectorAll('.tile').forEach(t => {
      t.addEventListener('mousemove', e => { const r = t.getBoundingClientRect(); t.style.setProperty('--mx', (e.clientX - r.left) + 'px'); });
    });
  }

  /* ============================================================
     Interstellar starfield — global fixed-canvas background.
     Twinkling stars + drifting stardust that rises from the horizon and
     stays put as you scroll. Ported from hakimz.com's hero (assets/main.js),
     adapted full-width for the hub and tuned to the blue→violet+gold tokens.
     Injects its own <canvas> so every page inherits it with no markup changes.
     Respects prefers-reduced-motion (static single frame, no drift).
     ============================================================ */
  function initSky() {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let canvas = document.getElementById('sky');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'sky'; canvas.className = 'sky-bg'; canvas.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(canvas, document.body.firstChild);
    }
    // global Interstellar light-beam (fixed, behind all content — styled in app.css)
    if (!document.querySelector('.beam')) {
      ['beam-bloom', 'beam'].forEach(cls => {
        const el = document.createElement('div');
        el.className = cls; el.setAttribute('aria-hidden', 'true');
        document.body.insertBefore(el, document.body.firstChild);
      });
    }
    if (!canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, stars = [], dust = [];
    const rand = (a, b) => a + Math.random() * (b - a);

    function resize() {
      W = canvas.clientWidth || window.innerWidth;
      H = canvas.clientHeight || window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars(); buildDust();
    }
    function buildStars() {
      stars = [];
      const count = Math.round((W * H) / 5200); // density scales with area
      for (let i = 0; i < count; i++) stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: rand(0.3, 1.5), base: rand(0.25, 0.85),
        tw: rand(0.4, 1.6), ph: rand(0, Math.PI * 2),
        warm: Math.random() < 0.12               // a few gold-tinted stars
      });
    }
    function spawnDust(initial) {
      return {
        x: Math.random() * W,                    // full-width drift (not a center beam)
        y: initial ? rand(0, H) : H + rand(0, 30),
        r: rand(0.4, 1.7),
        speed: rand(6, 20),                      // px/sec upward
        a: rand(0.18, 0.7),
        warm: Math.random() < 0.22               // gold fraction, like the Interstellar still
      };
    }
    function buildDust() {
      dust = [];
      const count = reduce ? 80 : Math.round(W / 5);
      for (let i = 0; i < count; i++) dust.push(spawnDust(true));
    }

    let last = performance.now();
    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const tw = reduce ? s.base : s.base * (0.6 + 0.4 * Math.sin(now / 1000 * s.tw + s.ph));
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.warm ? 'rgba(231,201,139,' + tw + ')' : 'rgba(220,232,255,' + tw + ')';
        ctx.fill();
      }
      for (let j = 0; j < dust.length; j++) {
        const d = dust[j];
        if (!reduce) d.y -= d.speed * dt;
        if (d.y < -10) { dust[j] = spawnDust(false); continue; }
        const prog = d.y / H;                    // 1 at bottom, 0 at top
        const alpha = d.a * Math.pow(prog, 0.6); // light rises from the horizon, fades upward
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = d.warm ? 'rgba(231,201,139,' + alpha + ')' : 'rgba(199,220,255,' + alpha + ')';
        ctx.fill();
      }
      if (!reduce) requestAnimationFrame(frame);
    }

    resize();
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 200); }, { passive: true });
    requestAnimationFrame(frame); // animates, or paints one static frame under reduced motion
  }

  /* ============================================================
     In-page image lightbox — click any figure / poster / [data-lightbox]
     to open it LARGER within the page (not a new tab). Zoom (wheel / pinch /
     buttons / double-click), pan (drag), Esc or backdrop to close. One shared
     instance, used on every hub page. Falls back to the link if JS is off.
     ============================================================ */
  let _lbx = null;
  function buildLightbox() {
    const el = document.createElement('div');
    el.className = 'lbx'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML =
      '<div class="lbx-toolbar">' +
        '<button class="lbx-btn" data-act="out" aria-label="Zoom out">−</button>' +
        '<button class="lbx-btn" data-act="reset" aria-label="Fit to screen">Fit</button>' +
        '<button class="lbx-btn" data-act="in" aria-label="Zoom in">+</button>' +
        '<a class="lbx-btn lbx-open" target="_blank" rel="noopener" aria-label="Open original file">↗</a>' +
        '<button class="lbx-btn" data-act="close" aria-label="Close">✕</button>' +
      '</div>' +
      '<div class="lbx-viewport"><img class="lbx-img" alt=""></div>' +
      '<div class="lbx-hint">scroll or pinch to zoom · drag to pan · double-click to reset</div>';
    document.body.appendChild(el);
    const vp = el.querySelector('.lbx-viewport'), img = el.querySelector('.lbx-img'), openLink = el.querySelector('.lbx-open');
    let scale = 1, tx = 0, ty = 0;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const apply = () => { img.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; img.style.cursor = scale > 1 ? 'grab' : 'auto'; };
    const reset = () => { scale = 1; tx = 0; ty = 0; apply(); };
    function zoomAt(cx, cy, factor) {
      const r = vp.getBoundingClientRect();
      const px = cx - r.left - r.width / 2, py = cy - r.top - r.height / 2;
      const ns = clamp(scale * factor, 1, 6);
      tx = px - (px - tx) * (ns / scale); ty = py - (py - ty) * (ns / scale); scale = ns;
      if (scale === 1) { tx = 0; ty = 0; }
      apply();
    }
    el.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.18 : 1 / 1.18); }, { passive: false });
    const pts = new Map(); let pinch = 0, sx = 0, sy = 0, btx = 0, bty = 0, drag = false;
    img.addEventListener('pointerdown', e => { pts.set(e.pointerId, e); if (pts.size === 1 && scale > 1) { drag = true; sx = e.clientX; sy = e.clientY; btx = tx; bty = ty; img.setPointerCapture(e.pointerId); img.style.cursor = 'grabbing'; } });
    img.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); if (pinch) zoomAt((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, d / pinch); pinch = d; drag = false; }
      else if (drag) { tx = btx + (e.clientX - sx); ty = bty + (e.clientY - sy); apply(); }
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; if (!pts.size) { drag = false; img.style.cursor = scale > 1 ? 'grab' : 'auto'; } };
    img.addEventListener('pointerup', up); img.addEventListener('pointercancel', up);
    img.addEventListener('dblclick', e => { e.preventDefault(); scale > 1 ? reset() : zoomAt(e.clientX, e.clientY, 2.4); });
    el.addEventListener('click', e => {
      const act = e.target.closest('[data-act]');
      if (act) { const a = act.dataset.act; if (a === 'close') close(); else if (a === 'reset') reset(); else { const r = vp.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, a === 'in' ? 1.4 : 1 / 1.4); } return; }
      if (e.target === vp || e.target === el) close();
    });
    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() { el.classList.remove('open'); document.removeEventListener('keydown', onKey); }
    el._open = (src, opts) => {
      opts = opts || {}; img.src = src; img.alt = opts.alt || '';
      if (opts.file && opts.file !== src) { openLink.href = opts.file; openLink.style.display = ''; } else { openLink.style.display = 'none'; }
      reset(); el.classList.add('open'); document.addEventListener('keydown', onKey);
    };
    return el;
  }
  function lightbox(src, opts) { if (!src) return; if (!_lbx) _lbx = buildLightbox(); _lbx._open(src, opts); }
  function initLightbox() {
    document.addEventListener('click', e => {
      const t = e.target.closest('.posterwrap, .figframe, .figimg-wrap, [data-lightbox]');
      if (!t) return;
      const img = t.matches('img') ? t : t.querySelector('img');
      const src = (img && (img.currentSrc || img.src)) || t.getAttribute('href') || t.getAttribute('data-lightbox');
      if (!src) return;
      e.preventDefault();
      lightbox(src, { alt: img && img.alt, file: t.getAttribute('href') });
    });
  }

  document.addEventListener('DOMContentLoaded', () => { initSky(); initNav(); initTileGlow(); initLightbox(); });
  global.Hub = { load, save, patch, toast, exportState, importState, addFeedback, carousel,
    fetchData, api, esc, relTime, fmtDate, initSky, lightbox };
})(window);
