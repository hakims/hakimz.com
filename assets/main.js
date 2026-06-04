/* ============================================================
   hakimz.com — hero starfield + drifting stardust, typed tagline,
   scroll reveals, parallax, pointer-glow. Vanilla JS, no deps.
   All motion respects prefers-reduced-motion.
   ============================================================ */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- footer year ---- */
  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ============================================================
     CANVAS: twinkling starfield + a vertical column of rising
     stardust that mirrors the Interstellar beam.
     ============================================================ */
  var canvas = document.getElementById('sky');
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var stars = [];       // ambient background stars
    var dust = [];        // beam particles rising up the center column
    var beamX = 0;        // center x of the beam (px)

    function rand(a, b) { return a + Math.random() * (b - a); }

    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      beamX = W * 0.5;
      buildStars();
      buildDust();
    }

    function buildStars() {
      stars = [];
      var count = Math.round((W * H) / 5200); // density scales with area
      for (var i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: rand(0.3, 1.5),
          base: rand(0.25, 0.85),
          tw: rand(0.4, 1.6),       // twinkle speed
          ph: rand(0, Math.PI * 2), // phase
          warm: Math.random() < 0.12 // a few warm-tinted stars
        });
      }
    }

    function buildDust() {
      dust = [];
      var count = reduceMotion ? 90 : Math.round(W / 4.2);
      for (var i = 0; i < count; i++) dust.push(spawnDust(true));
    }

    function spawnDust(initial) {
      // narrow band near horizon, widening slightly as it rises
      var spreadBase = Math.max(40, W * 0.05);
      return {
        y: initial ? rand(H * 0.05, H) : H + rand(0, 30),
        ox: rand(-1, 1),                 // normalized offset across the beam width
        spread: spreadBase,
        r: rand(0.4, 1.8),
        speed: rand(8, 26),              // px/sec upward
        a: rand(0.2, 0.9),
        warm: Math.random() < 0.22       // rose/peach fraction, like the still
      };
    }

    var last = performance.now();
    function frame(now) {
      var dt = Math.min((now - last) / 1000, 0.05); last = now;
      ctx.clearRect(0, 0, W, H);

      // --- stars ---
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var tw = reduceMotion ? s.base : s.base * (0.6 + 0.4 * Math.sin(now / 1000 * s.tw + s.ph));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.warm
          ? 'rgba(246,217,194,' + tw + ')'
          : 'rgba(220,235,255,' + tw + ')';
        ctx.fill();
      }

      // --- stardust column (drifts up; denser & brighter near base) ---
      for (var j = 0; j < dust.length; j++) {
        var d = dust[j];
        if (!reduceMotion) d.y -= d.speed * dt;
        if (d.y < -10) { dust[j] = spawnDust(false); continue; }

        var prog = d.y / H;                 // 1 at bottom, 0 at top
        var width = d.spread * (0.5 + (1 - prog) * 1.4); // widens upward
        var x = beamX + d.ox * width;
        // brightness fades toward the top, peaks at the base
        var alpha = d.a * Math.pow(prog, 0.8);
        ctx.beginPath();
        ctx.arc(x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = d.warm
          ? 'rgba(242,184,176,' + alpha + ')'
          : 'rgba(207,238,252,' + alpha + ')';
        ctx.fill();
      }

      if (!reduceMotion) requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', debounce(resize, 200));
    if (reduceMotion) {
      // draw a single static frame
      requestAnimationFrame(frame);
    } else {
      requestAnimationFrame(frame);
    }
  }

  /* ============================================================
     TYPED TAGLINE — cycles a few evocative lines.
     ============================================================ */
  var typedEl = document.querySelector('#tagline .typed');
  var caretEl = document.querySelector('#tagline .caret');
  if (typedEl) {
    var lines = [
      'Building small, strange, useful things.',
      'Surgery by day. Side projects by starlight.',
      'Chasing ideas across the event horizon.',
      'Code, research, and the occasional dark sky.'
    ];
    if (reduceMotion) {
      typedEl.textContent = lines[0];
      if (caretEl) caretEl.style.display = 'none';
    } else {
      var li = 0, ci = 0, deleting = false;
      (function tick() {
        var line = lines[li];
        if (!deleting) {
          ci++;
          typedEl.textContent = line.slice(0, ci);
          if (ci >= line.length) { deleting = true; return setTimeout(tick, 2200); }
          setTimeout(tick, 42 + Math.random() * 40);
        } else {
          ci--;
          typedEl.textContent = line.slice(0, ci);
          if (ci <= 0) { deleting = false; li = (li + 1) % lines.length; return setTimeout(tick, 320); }
          setTimeout(tick, 22);
        }
      })();
    }
  }

  /* ============================================================
     SCROLL REVEAL — sections fade/slide in once.
     ============================================================ */
  var sections = document.querySelectorAll('.section');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    sections.forEach(function (s) { io.observe(s); });
  } else {
    sections.forEach(function (s) { s.classList.add('in'); });
  }

  /* ============================================================
     PARALLAX — gentle drift of beam + nebula on scroll.
     ============================================================ */
  var beam = document.querySelector('.beam');
  var bloom = document.querySelector('.beam-bloom');
  var nebula = document.querySelector('.nebula');
  var copy = document.querySelector('.hero-copy');
  if (!reduceMotion && (beam || nebula)) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY;
        if (y < window.innerHeight) {
          if (beam) beam.style.transform = 'translateX(-50%) translateY(' + (y * 0.18) + 'px)';
          if (bloom) bloom.style.transform = 'translateX(-50%) translateY(' + (y * 0.10) + 'px)';
          if (nebula) nebula.style.transform = 'translateY(' + (y * 0.30) + 'px)';
          if (copy) { copy.style.transform = 'translateY(' + (y * -0.12) + 'px)'; copy.style.opacity = Math.max(0, 1 - y / (window.innerHeight * 0.7)); }
        }
        ticking = false;
      });
    }, { passive: true });
  }

  /* ============================================================
     POINTER GLOW — cards track the cursor (matches hub tiles).
     ============================================================ */
  document.querySelectorAll('.card').forEach(function (c) {
    c.addEventListener('mousemove', function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    });
  });

  /* placeholder external links: don't navigate from the scaffold */
  document.querySelectorAll('a[data-ext]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (a.getAttribute('href') === '#') e.preventDefault();
    });
  });

  function debounce(fn, ms) {
    var t; return function () { clearTimeout(t); var args = arguments, self = this; t = setTimeout(function () { fn.apply(self, args); }, ms); };
  }
})();
