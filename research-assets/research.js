/* Alfred Hub — Research renderers (rev 2026-06-12b).
   Pure presentation; content is live from brain/memory/research/<id>.json
   (kept current by the research-sync skill). Powers research.html (3D tilt cards)
   and project.html (full manuscript). Charts are native SVG built from the
   manuscript's real numbers — colors approximate the source figures, with each
   MODEL carrying a signature hue and training condition shown as opacity. */
(function (global) {
  const esc = (s) => (global.Hub ? Hub.esc(s) : String(s == null ? '' : s));
  const fmt = (v, d = 0) => Number(v).toFixed(d);

  // Signature hues: models keep one color across every figure; error types are categorical.
  const PAL = {
    claude: '#E8A24C', gemini: '#6DA5FF', gpt: '#34D399', ref: '#E7C98B', neutral: '#9aa6bf',
    correct: '#34D399', over: '#8b8cf8', under: '#6DA5FF', mis_rated: '#E8A24C', mis_unrated: '#F2724B', noresp: '#5b6577'
  };
  const LEG = { claude: 'Claude', gemini: 'Gemini', gpt: 'GPT', ref: 'Gold standard (human coders)' };

  // legend(items): each item {t, c?|k?, o?}. Color from c, else PAL[k]; o = swatch opacity.
  function legend(items) {
    if (!items || !items.length) return '';
    return `<div class="fleg">${items.map(it => {
      const c = it.c || PAL[it.k] || PAL.neutral, o = it.o != null ? it.o : 1;
      return `<span><i style="background:${c};opacity:${o}"></i>${esc(it.t || LEG[it.k] || it.k)}</span>`;
    }).join('')}</div>`;
  }

  // Grouped bar chart. Bars: {v, k|c, u?(untrained→faded), o?(explicit opacity), t?(label)}.
  function figBars(f) {
    const W = 520, H = 240, padL = 42, padR = 14, padT = 18, padB = 38;
    const max = f.max, plotW = W - padL - padR, gw = plotW / f.groups.length;
    const Y = (v) => padT + (1 - v / max) * (H - padT - padB);
    let s = '';
    for (let i = 0; i <= 4; i++) { const v = max * i / 4, y = Y(v); s += `<line class="gl" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"/><text class="axis" x="6" y="${y + 3}" text-anchor="end">${fmt(v, f.ad || 0)}</text>`; }
    f.groups.forEach((g, gi) => {
      const n = g.bars.length, bw = Math.min(44, (gw * 0.74) / n), gx = padL + gi * gw + gw / 2, total = n * bw + (n - 1) * 5, sx = gx - total / 2;
      g.bars.forEach((b, bi) => {
        const x = sx + bi * (bw + 5), y = Y(Math.abs(b.v)), hh = H - padB - y;
        const col = b.c || PAL[b.k] || PAL.neutral, op = b.o != null ? b.o : (b.u ? 0.4 : 1);
        const cx = x + bw / 2; let labelY = y - 5, ebar = '';
        // Error bar: b.ci=[lo,hi] (absolute) or b.e=half-width (symmetric SD/CI).
        const ci = b.ci || (b.e != null ? [b.v - b.e, b.v + b.e] : null);
        if (ci) {
          const yHi = Y(Math.max(ci[0], ci[1])), yLo = Y(Math.min(ci[0], ci[1])), cap = Math.max(2.5, Math.min(5, bw / 3));
          ebar = `<line class="ebar" x1="${cx}" y1="${yHi}" x2="${cx}" y2="${yLo}"/><line class="ebar" x1="${cx - cap}" y1="${yHi}" x2="${cx + cap}" y2="${yHi}"/><line class="ebar" x1="${cx - cap}" y1="${yLo}" x2="${cx + cap}" y2="${yLo}"/>`;
          labelY = Math.min(labelY, yHi - 4);
        }
        s += `<rect class="bar" x="${x}" y="${y}" width="${bw}" height="${Math.max(0, hh)}" rx="3" fill="${col}" fill-opacity="${op}"/>${ebar}
          <text class="val" x="${cx}" y="${labelY}" text-anchor="middle">${b.t || fmt(Math.abs(b.v), f.vd ?? 0)}</text>`;
      });
      s += `<text class="axis" x="${gx}" y="${H - padB + 16}" text-anchor="middle">${esc(g.label)}</text>`;
    });
    if (f.yl) s += `<text class="axis" x="${padL}" y="11" text-anchor="start" style="fill:var(--muted)">${esc(f.yl)}</text>`;
    return svg(f, s, W, H);
  }

  // 100%-stacked columns (used for Figure 2 error distribution). groups:{label,sub,segs:[{v,k|c}]}.
  function figStack(f) {
    const W = 540, H = 270, padL = 30, padR = 10, padT = 14, padB = 48;
    const n = f.groups.length, plotW = W - padL - padR, plotH = H - padT - padB, slot = plotW / n, cw = slot * 0.62;
    const Y = (v) => padT + (1 - v / 100) * plotH;
    let s = '';
    for (let i = 0; i <= 4; i++) { const v = i * 25, y = Y(v); s += `<line class="gl" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"/><text class="axis" x="6" y="${y + 3}" text-anchor="end">${v}</text>`; }
    f.groups.forEach((g, gi) => {
      const x = padL + gi * slot + (slot - cw) / 2; let acc = 0;
      g.segs.forEach(seg => {
        const y1 = Y(acc + seg.v), h = Y(acc) - y1, col = seg.c || PAL[seg.k] || PAL.neutral;
        s += `<rect x="${x}" y="${y1}" width="${cw}" height="${Math.max(0, h)}" fill="${col}"/>`;
        if (seg.v >= 7) s += `<text x="${x + cw / 2}" y="${y1 + h / 2 + 3.5}" text-anchor="middle" style="fill:#0b1020;font-size:10px;font-weight:800">${Math.round(seg.v)}</text>`;
        acc += seg.v;
      });
      s += `<text class="axis" x="${x + cw / 2}" y="${H - padB + 16}" text-anchor="middle">${esc(g.label)}</text>`;
      if (g.sub) s += `<text class="axis" x="${x + cw / 2}" y="${H - padB + 29}" text-anchor="middle" style="opacity:.65">${esc(g.sub)}</text>`;
    });
    if (f.yl) s += `<text class="axis" x="${padL}" y="11" text-anchor="start" style="fill:var(--muted)">${esc(f.yl)}</text>`;
    return svg(f, s, W, H);
  }

  function svg(f, inner, W, H) {
    return `<svg class="figsvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(f.title || 'figure')}">${inner}</svg>`;
  }
  const figChart = (f) => (f.type === 'stack' ? figStack(f) : figBars(f));

  // --- Card carousel slides (research.html) ---
  // Poster slide (a project's conference poster) — shown first when m.poster exists.
  // Image is height-capped so the whole poster is visible without scrolling; click opens the full file.
  function posterSlide(m) {
    const p = m.poster || {};
    const href = p.file || p.image;
    const cap = p.caption ? `<p class="fsub poster-cap">${esc(p.caption)}</p>` : '';
    return `<div class="figslide posterslide"><p class="slide-lab">${esc(p.label || 'Conference poster')}</p>` +
      `<a class="posterwrap" href="${esc(href)}" target="_blank" rel="noopener" title="Open the full poster">` +
      `<img src="${esc(p.image)}" alt="${esc(m.short_title || m.title || 'Conference poster')}">` +
      `<span class="poster-zoom">⤢ Full poster</span></a>${cap}</div>`;
  }
  function abstractSlide(m) {
    const a = m.abstract || {};
    const blocks = Object.keys(a).map(k => `<div class="ab"><b>${esc(k)}</b><p>${esc(a[k])}</p></div>`).join('');
    return `<div class="figslide"><p class="slide-lab">Abstract</p><div class="abs">${blocks}</div></div>`;
  }
  function figureSlide(f) {
    if (f.type === 'image') {
      // Real manuscript figure embedded as-is (preserves error bars, p-values, flowcharts).
      return `<div class="figslide imgfig"><h4>${esc(f.num)} · ${esc(f.title)}</h4>` +
        `<a class="figframe" href="${esc(f.src)}" target="_blank" rel="noopener" title="Open figure full size">` +
        `<img src="${esc(f.src)}" alt="${esc(f.num)} ${esc(f.title)}"></a>` +
        `<p class="fsub figcap">${esc(f.caption)}</p></div>`;
    }
    return `<div class="figslide"><h4>${esc(f.num)} · ${esc(f.title)}</h4>
      <p class="fsub">${esc(f.caption)}</p>${legend(f.legend)}${figChart(f)}</div>`;
  }
  function takeawaysSlide(m) {
    return `<div class="figslide"><p class="slide-lab">Key takeaways · high-yield</p>
      <ul class="hiyield">${(m.takeaways || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
  }

  function carousel(root, slides, opts = {}) {
    const track = root.querySelector('.figtrack'), dots = root.querySelector('.fdots'), stage = root.querySelector('.figstage');
    track.innerHTML = slides.join('');
    dots.innerHTML = slides.map((_, i) => `<i data-i="${i}" class="${i === 0 ? 'on' : ''}"></i>`).join('');
    let i = 0; const n = slides.length;
    // Dynamic windowing: size the stage to the active slide, capped to the viewport
    // (--fig-cap) so the whole module always fits on screen — desktop and mobile.
    const fit = () => {
      const cap = Math.round(Math.min(global.innerHeight * 0.66, 520));
      root.style.setProperty('--fig-cap', cap + 'px');
      const active = track.children[i];
      if (stage && active) stage.style.height = Math.min(active.scrollHeight, cap) + 'px';
    };
    const show = () => { track.style.transform = `translateX(-${i * 100}%)`; dots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k === i)); fit(); };
    dots.querySelectorAll('i').forEach(d => d.onclick = () => { i = +d.dataset.i; show(); });
    root.querySelector('[data-c=prev]').onclick = () => { i = (i - 1 + n) % n; show(); };
    root.querySelector('[data-c=next]').onclick = () => { i = (i + 1) % n; show(); };
    const reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && opts.autoplay) {
      let t; const arm = () => t = setInterval(() => { i = (i + 1) % n; show(); }, opts.autoplay);
      arm(); root.addEventListener('mouseenter', () => clearInterval(t)); root.addEventListener('mouseleave', arm);
    }
    // Images (e.g. a poster slide) settle their height asynchronously — re-fit when each loads.
    track.querySelectorAll('img').forEach(im => { if (!im.complete) im.addEventListener('load', fit, { once: true }); });
    global.addEventListener('resize', fit);
    show();
    global.requestAnimationFrame(fit);
  }

  function tilt(stage) {
    const card = stage.querySelector('.r3d');
    const reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !card) return;
    stage.addEventListener('pointermove', e => {
      const r = stage.getBoundingClientRect(), dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `rotateY(${dx * 7}deg) rotateX(${-dy * 7}deg)`;
      card.style.setProperty('--gx', ((dx + .5) * 100) + '%'); card.style.setProperty('--gy', ((dy + .5) * 100) + '%');
    });
    stage.addEventListener('pointerleave', () => { card.style.transform = 'rotateY(0) rotateX(0)'; });
  }

  // --- Full-manuscript helpers (project.html) ---
  function figBlock(f) {
    const body = f.type === 'image'
      ? `<a class="figimg-wrap" href="${esc(f.src)}" target="_blank" rel="noopener"><img class="figimg" src="${esc(f.src)}" alt="${esc(f.num)} ${esc(f.title)}"></a>`
      : `${legend(f.legend)}${figChart(f)}`;
    return `<figure class="figblock" id="fig-${esc(f.key)}"><span class="fnum">${esc(f.num)}</span>
      <h4>${esc(f.title)}</h4>${body}
      <figcaption>${esc(f.caption)}</figcaption></figure>`;
  }
  // Number + label at the TOP (caption-side top); notes optional below the table.
  function tableBlock(t) {
    const head = `<tr>${t.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr>`;
    const body = t.rows.map(r => `<tr${r.total ? ' class="trow-total"' : ''}>${(r.cells || r).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
    return `<figure class="rtable-wrap" id="tab-${esc(t.key || '')}"><figcaption class="tcap"><b>${esc(t.label)}.</b> ${esc(t.caption || '')}</figcaption>
      <table class="rtable"><thead>${head}</thead><tbody>${body}</tbody></table>${t.note ? `<p class="tnote">${esc(t.note)}</p>` : ''}</figure>`;
  }
  const tablesBlock = (arr) => (arr || []).map(tableBlock).join('');

  // Body paragraph with inline citation markers: [1], [9-11], [20,21] → superscripts.
  const cite = (s) => s.replace(/\[(\d+(?:[–,\-]\d+)*)\]/g, '<sup class="cite">$1</sup>');
  const para = (t) => '<p>' + cite(esc(t)) + '</p>';
  const paras = (arr) => (arr || []).map(para).join('');

  global.Research = { PAL, LEG, legend, figBars, figStack, figChart, posterSlide, abstractSlide, figureSlide, takeawaysSlide, carousel, tilt, figBlock, tableBlock, tablesBlock, cite, para, paras };
})(window);
