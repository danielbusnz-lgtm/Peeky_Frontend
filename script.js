// Keep the GitHub star count current.
fetch('https://api.github.com/repos/danielbusnz-lgtm/Peeky')
  .then((r) => r.ok ? r.json() : null)
  .then((data) => {
    if (data && typeof data.stargazers_count === 'number') {
      document.getElementById('stars').textContent = `★ ${data.stargazers_count}`;
    }
  })
  .catch(() => {});

// Demo video: activates itself once a <source> is dropped into #demo.
// Plays only while on screen; reduced motion gets a poster + controls instead.
const demo = document.getElementById('demo');
if (demo && demo.querySelector('source')) {
  demo.classList.remove('hidden');
  document.getElementById('demoPlaceholder')?.remove();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    demo.controls = true;
  } else {
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) demo.play().catch(() => {});
      else demo.pause();
    }, { threshold: 0.4 }).observe(demo);
  }

  // Hero captions, keyed to the video's currentTime and rendered every
  // frame. Times are in PADDED-video seconds (the clip starts after a 1.5s
  // idle freeze), measured frame-by-frame in mpv. who: 'user' = spoken
  // command (neutral pill), 'peeky' = its reply (blue, led by the cursor
  // mark). thinkAt = when the thinking dots appear ahead of a reply.
  attachCaptionPill(
    demo,
    document.getElementById('demoCaption'),
    document.getElementById('demoMeasure'),
    [
      { start: 2.45,  end: 4.5,   who: 'user',  text: 'Can you open up my lease agreement?' },
      { start: 5.18,  end: 7.1,   who: 'peeky', text: 'Opening it up now', thinkAt: 4.5 },
      { start: 7.2,   end: 9.4,   who: 'user',  text: "What's the monthly rent?" },
      { start: 10.28, end: 12.73, who: 'peeky', text: "Found it, it's $2,450 a month", thinkAt: 9.4 },
      { start: 12.83, end: 15.14, who: 'user',  text: 'Is there a section about pets?' },
      { start: 16.1,  end: 17.3,  who: 'peeky', text: 'Yes, right here', thinkAt: 15.14 },
    ]
  );
}

// Use-case cards: each demo video gets the same caption pill, sized down
// by .demo-caption--sm. Direct video time — these clips have no freeze pad.
attachCaptionPill(
  document.getElementById('momDemo'),
  document.getElementById('momCaption'),
  document.getElementById('momMeasure'),
  [
    { start: 0.6,  end: 3.28, who: 'user',  text: 'Make a note to remind me to call mom at 9pm' },
    { start: 4.91, end: 9.7,  who: 'peeky', text: "Sure, I'll write that down", thinkAt: 3.29 },
  ]
);
attachCaptionPill(
  document.getElementById('numbersDemo'),
  document.getElementById('numbersCaption'),
  document.getElementById('numbersMeasure'),
  [
    { start: 0.86, end: 2.73, who: 'user',  text: 'Which button adds a new sheet?' },
    { start: 3.68, end: 5.56, who: 'peeky', text: 'This one, up top', thinkAt: 2.74 },
  ]
);
attachCaptionPill(
  document.getElementById('newsDemo'),
  document.getElementById('newsCaption'),
  document.getElementById('newsMeasure'),
  [
    { start: 1.33, end: 3.97, who: 'user',  text: 'Can you pull up recent news for me?' },
    { start: 5.8,  end: 6.9,  who: 'peeky', text: 'Sure, here you go', thinkAt: 3.98 },
  ]
);

// Card switching: clicking a use-case card shows its demo slide and restarts
// the clip. Only cards with a data-demo participate; the rest are inert.
(() => {
  const cards = document.querySelectorAll('.usecase[data-demo]');
  const slides = document.querySelectorAll('.usecase-slide');
  if (!cards.length || !slides.length) return;
  function show(name) {
    slides.forEach((s) => {
      const on = s.dataset.demo === name;
      s.classList.toggle('is-active', on);
      const v = s.querySelector('video');
      if (!v) return;
      if (on) { v.currentTime = 0; v.play().catch(() => {}); }
      else { v.pause(); }
    });
    cards.forEach((c) => c.classList.toggle('active', c.dataset.demo === name));
  }
  cards.forEach((c) => c.addEventListener('click', () => show(c.dataset.demo)));
})();

// The liquid-glass caption pill renderer: drives one pill (capEl) over one
// video, measuring target width with a hidden twin (measurer) and rendering
// per-frame. Safe to call with missing elements; it just does nothing.
function attachCaptionPill(video, capEl, measurer, captions) {
  // Replies show thinking dots from thinkFrom until their start time. A
  // measured thinkAt wins; otherwise dots fill the gap after the previous
  // caption, at most 0.6s before the reply.
  captions.forEach((c, i) => {
    const prevEnd = i > 0 ? captions[i - 1].end : 0;
    c.thinkFrom = c.who === 'peeky'
      ? (c.thinkAt !== undefined ? c.thinkAt : Math.max(prevEnd + 0.05, c.start - 0.6))
      : null;
  });

  if (video && capEl && measurer) {
    const contentEl = capEl.querySelector('.glass-content');
    const measureContent = measurer.querySelector('.glass-content');
    // Peeky's replies lead with the orange cursor mark. Commands are plain.
    const peekyIcon = '<img src="cursor.svg" alt="" class="demo-caption-icon">';

    let lastKey = null;
    let lastShown = 0;
    let wordsEl = null;
    let mode = null;        // 'dots' | 'words'
    let measureCache = '';
    let curW = null;        // spring position: animated pill width
    let velW = 0;           // spring velocity (px/s), also drives squash
    let presence = 0;       // 0 = gone, 1 = fully materialized
    let lastActiveAt = -1;
    let lastTs = null;
    let lastT = null;       // previous frame's video time, to detect rewinds

    // Width spring, slightly underdamped (critical damping for k=300 is
    // ~34.6) so the bubble overshoots a few percent and feels like gel.
    const SPRING_K = 300;
    const SPRING_C = 24;

    // Per-frame rendering instead of the timeupdate event: timeupdate only
    // fires ~4x/s, which makes word reveal and pill growth feel chunky.
    function captionFrame(ts) {
      const dt = Math.min(lastTs === null ? 0 : (ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      const t = video.currentTime;

      // The video clock jumped backwards: a card switch rewound the clip,
      // or the loop wrapped. Kill the pill instantly and forget all state —
      // otherwise the previous run's caption lingers (squeezed to a sliver
      // by the hidden slide's zero-width measurer) while the new run starts.
      if (lastT !== null && t < lastT - 0.4) {
        lastKey = null;
        lastShown = 0;
        mode = null;
        measureCache = '';
        curW = null;
        velW = 0;
        presence = 0;
        lastActiveAt = -1;
      }
      lastT = t;

      // A reply becomes active early, at thinkFrom, so dots can occupy the
      // gap between the question and the answer.
      const active = captions.find(
        (c) => t >= (c.thinkFrom !== null ? c.thinkFrom : c.start) && t < c.end
      );

      if (active) {
        const key = active.start + active.text;
        if (key !== lastKey) {
          lastKey = key;
          lastShown = 0;
          mode = null;
        }

        const thinking = active.thinkFrom !== null && t < active.start;
        const wantMode = thinking ? 'dots' : 'words';
        if (mode !== wantMode) {
          contentEl.innerHTML =
            (active.who === 'peeky' ? peekyIcon : '') +
            (wantMode === 'dots'
              ? '<span class="dots"><i></i><i></i><i></i></span>'
              : '<span class="words"></span>');
          wordsEl = contentEl.querySelector('.words');
          capEl.classList.toggle('peeky', active.who === 'peeky');
          mode = wantMode;
        }

        const words = active.text.split(' ');
        if (!thinking) {
          // Word-by-word reveal over the first ~55% of the window (capped)
          // so it reads as spoken; each word is a span so it animates in.
          const reveal = Math.min((active.end - active.start) * 0.55, 1.5);
          const progress = reveal > 0 ? (t - active.start) / reveal : 1;
          const shown = Math.max(
            1,
            Math.ceil(Math.min(Math.max(progress, 0), 1) * words.length)
          );
          for (let i = lastShown; i < shown; i++) {
            if (i > 0) wordsEl.appendChild(document.createTextNode(' '));
            const w = document.createElement('span');
            w.className = 'w';
            w.textContent = words[i];
            wordsEl.appendChild(w);
          }
          lastShown = Math.max(lastShown, shown);
        }

        // Measure the hidden twin, then spring the real pill toward that
        // width — CSS can't animate width:auto, springing avoids steps.
        const sig = key + '|' + (thinking ? 'dots' : lastShown);
        if (sig !== measureCache) {
          measureContent.innerHTML =
            (active.who === 'peeky' ? peekyIcon : '') +
            (thinking
              ? '<span class="dots"><i></i><i></i><i></i></span>'
              : '<span class="words">' + words.slice(0, lastShown).join(' ') + '</span>');
          measureCache = sig;
        }
        const targetW = measurer.offsetWidth;

        if (curW === null || presence < 0.4) {
          // Materializing from nothing: start at size, the scale-up is the
          // entrance — no width zoom from zero.
          curW = targetW;
          velW = 0;
        } else {
          const accel = SPRING_K * (targetW - curW) - SPRING_C * velW;
          velW += accel * dt;
          curW += velW * dt;
          if (Math.abs(targetW - curW) < 0.3 && Math.abs(velW) < 8) {
            curW = targetW;
            velW = 0;
          }
        }
        capEl.style.width = curW + 'px';
        lastActiveAt = ts;
      }

      // Presence: materialize in, dissolve out. Held through sub-250ms
      // gaps so consecutive captions morph instead of blinking.
      const wantShown = !!active || (lastActiveAt >= 0 && ts - lastActiveAt < 250);
      const rate = wantShown ? 13 : 9;
      presence += ((wantShown ? 1 : 0) - presence) * (1 - Math.exp(-rate * dt));
      if (presence < 0.001) presence = 0;
      if (presence > 0.999) presence = 1;

      // Condense in from 92% scale with content sharpening; fast width
      // changes squash the height slightly so the pill feels like gel.
      const scale = 0.92 + 0.08 * presence;
      const rise = (1 - presence) * -6;
      const squash = 1 - Math.min(Math.abs(velW) * 0.00045, 0.07);
      capEl.style.opacity = presence;
      capEl.style.visibility = presence > 0.01 ? 'visible' : 'hidden';
      capEl.style.transform =
        'translate(-50%, ' + rise + 'px) scale(' + scale + ') scaleY(' + squash + ')';
      contentEl.style.filter =
        presence < 1 ? 'blur(' + ((1 - presence) * 5).toFixed(2) + 'px)' : 'none';

      requestAnimationFrame(captionFrame);
    }
    requestAnimationFrame(captionFrame);
  }
}

// Soundwave on the privacy card. Direct port of peeky/src/painter.rs:
// same constants, same harmonics, same bell-curve silhouette. The app's
// envelope opens with live mic level; a web page has no mic, so level
// stays 0.0 and the wave idles exactly like Peeky during silence.
(() => {
  const canvas = document.getElementById('soundwave');
  if (!canvas) return;

  const N_BARS = 5;
  const BAR_WIDTH = 3.0;
  const BAR_GAP = 1.5;
  const MIN_HEIGHT = 6.0;
  const MAX_HEIGHT = 28.0;
  const SCROLL_SPEED = 0.7;
  const CORNER_RADIUS = 1.5;
  const COLOR = 'rgba(255, 140, 0, 0.95)'; // (1.00, 0.55, 0.00, 0.95)
  const HARMONICS = [[1.5, 0.0, 0.55], [3.1, 1.0, 0.30], [5.7, 2.4, 0.15]];
  const SHAPE_FLOOR = 0.4;

  // No mic on the web, so synthesize a speech-like level: phrases of
  // syllable-rate bursts separated by breath pauses.
  function currentAudioLevel() {
    const t = (performance.now() - start) / 1000;
    const phrase = Math.sin(t * 0.9) + Math.sin(t * 0.53 + 1.7);
    const talking = Math.min(Math.max((phrase + 0.6) / 1.2, 0), 1);
    const syllables = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 4.2 + Math.sin(t * Math.PI * 2 * 1.3) * 2);
    return talking * (0.12 + 0.28 * syllables);
  }

  const weightSum = HARMONICS.reduce((s, h) => s + h[2], 0);
  const waveW = N_BARS * BAR_WIDTH + (N_BARS - 1) * BAR_GAP;

  // painter.rs draws at cursor scale; the card badge renders the same
  // geometry, just uniformly scaled up.
  const RENDER_SCALE = 2.0;
  const ctx = canvas.getContext('2d');
  const dpr = devicePixelRatio || 1;
  const cssSize = canvas.getBoundingClientRect();
  canvas.width = cssSize.width * dpr;
  canvas.height = cssSize.height * dpr;

  function bars(t) {
    const originX = -waveW / 2.0;
    const envelope = Math.min(0.3 + currentAudioLevel() * 2.0, 1.0);
    const out = [];
    for (let i = 0; i < N_BARS; i++) {
      const u = i / (N_BARS - 1);
      const scrolled = u + t * SCROLL_SPEED;
      let raw = 0.0;
      for (const [freq, phase, weight] of HARMONICS) {
        const theta = scrolled * freq * Math.PI * 2 + phase;
        raw += Math.sin(theta) * (weight / weightSum);
      }
      const unit = (raw + 1.0) / 2.0;
      const shape = SHAPE_FLOOR + (1.0 - SHAPE_FLOOR) * Math.sin(u * Math.PI);
      const barH = (MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * unit * envelope) * shape;
      const bx = originX + i * (BAR_WIDTH + BAR_GAP);
      const by = -barH / 2.0;
      out.push([bx, by, BAR_WIDTH, barH]);
    }
    return out;
  }

  const start = performance.now();
  function draw(now) {
    const t = (now - start) / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssSize.width, cssSize.height);
    ctx.translate(cssSize.width / 2, cssSize.height / 2);
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    ctx.fillStyle = COLOR;
    for (const [bx, by, bw, bh] of bars(t)) {
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, CORNER_RADIUS);
      ctx.fill();
    }
  }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    draw(start); // one static frame
  } else {
    const loop = (now) => { draw(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
})();

// Use-case cards: clicking one makes it the active (highlighted) one.
// Later: also swap the demo recording to match.
const usecases = document.querySelectorAll('.usecase');
usecases.forEach((card) => card.addEventListener('click', () => {
  usecases.forEach((c) => c.classList.remove('active'));
  card.classList.add('active');
}));

// Scroll-in reveals: glide .reveal elements in the first time they enter
// the viewport. CSS handles the motion; this only flips the class.
const revealObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  }
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

// The headline's period is the cursor at rest. The real glyph only reserves
// layout space; #cursor, a 12px orange dot pinned to its spot every frame,
// plays the period. At 3s it morphs into the cursor silhouette (clip-path
// transition in CSS), swaps to the real svg, and flies off to trail the
// pointer.
const cursor = document.getElementById('cursor');
const periodDot = document.getElementById('periodDot');
let mouseX = null, mouseY = null;
let cursorX = null, cursorY = null;
let released = false;

// Offset from the real pointer: positive X moves right, negative Y moves up.
const OFFSET_X = 16;
const OFFSET_Y = -20;

// Touch and reduced-motion get no cursor sprite (CSS hides it), so the
// real period glyph stays visible there instead.
const cursorDisabled = matchMedia('(prefers-reduced-motion: reduce), (hover: none)').matches;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

// Hand-traced cursor.svg silhouette, percent coords of the sprite box.
const ARROW = [
  [32.0,78.3],[37.3,90.0],[46.3,86.0],[47.2,83.2],[46.5,81.0],[53.0,78.0],
  [54.0,75.0],[53.2,72.2],[65.8,66.8],[67.8,70.7],[76.2,67.2],[78.3,71.5],
  [87.0,68.0],[88.2,65.0],[83.3,54.3],[79.3,56.2],[75.0,47.5],[71.0,49.3],
  [66.8,40.8],[62.5,42.5],[58.3,34.0],[54.3,35.7],[50.3,27.3],[46.2,28.8],
  [42.5,21.0],[33.8,24.7],[37.5,33.0],[33.2,35.2],[37.0,43.7],[33.0,45.7],
  [36.8,54.2],[32.5,56.3],[36.5,64.8],[32.0,67.2],[36.3,75.3],[32.2,77.7],
];

function toClip(points) {
  return `polygon(${points.map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`).join(',')})`;
}

// The circle matches ARROW vertex for vertex: same count, first point
// aimed at ARROW's first point so the morph doesn't spin, winding matched
// via signed area so it doesn't fold through itself.
function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a;
}

function circlePoints(n) {
  const start = Math.atan2(ARROW[0][1] - 50, ARROW[0][0] - 50);
  const dir = Math.sign(signedArea(ARROW)) || 1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = start + dir * (i / n) * Math.PI * 2;
    out.push([50 + 50 * Math.cos(a), 50 + 50 * Math.sin(a)]);
  }
  return out;
}

cursor.style.clipPath = toClip(circlePoints(ARROW.length));

// Sequence: the real period glyph rises with "talking" inside the word
// mask; the moment that animation ends, the dot takes its place (same spot,
// instant, so the swap is invisible). It morphs at 3s over the CSS
// transition's 2s, then takes off.
// The span rect covers the whole line box, not the period's ink, so the dot
// is sized and offset from real glyph metrics: canvas measureText gives the
// ink box, a 0x0 inline probe gives the baseline.
let dotDX = 0, dotDY = 0;

function calibrate() {
  const r = periodDot.getBoundingClientRect();
  const probe = document.createElement('span');
  probe.style.cssText = 'display:inline-block;width:0;height:0';
  periodDot.parentElement.insertBefore(probe, periodDot);
  const baseline = probe.getBoundingClientRect().bottom;
  probe.remove();
  const cs = getComputedStyle(periodDot);
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const m = ctx.measureText('.');
  const inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
  // a hair under the ink box: the glyph isn't a perfect circle and the
  // solid orange disc reads slightly bolder than the rendered period
  const size = Math.min(inkW, inkH) * 0.92;
  cursor.style.width = `${size}px`;
  cursor.style.height = `${size}px`;
  // center the disc inside the ink box
  dotDX = -m.actualBoundingBoxLeft + (inkW - size) / 2;
  dotDY = baseline - m.actualBoundingBoxAscent - r.top + (inkH - size) / 2;
}

if (!cursorDisabled) {
  periodDot.closest('.word-in').addEventListener('animationend', () => {
    calibrate();
    periodDot.style.visibility = 'hidden';
    cursor.style.opacity = '1';
    cursor.style.clipPath = toClip(ARROW); // morph starts the moment it spawns
    // take off while the morph's slow tail finishes in flight (transform
    // and clip-path animate independently)
    setTimeout(() => { released = true; }, 1300);
    setTimeout(() => {
      // silhouettes align now: swap the flat fill for the real svg so the
      // two-tone shading appears
      cursor.style.background = "url('cursor.svg') no-repeat center / contain";
      cursor.style.clipPath = 'none';
    }, 2050);
  }, { once: true });
}

// Where the dot sits while parked: the calibrated ink-box offset from the
// glyph's rect, recomputed every frame so scroll never desyncs it.
function periodSpot() {
  const r = periodDot.getBoundingClientRect();
  return [r.left + dotDX, r.top + dotDY];
}

function animate() {
  if (released) {
    // No mousemove yet means the pointer position is unknowable; head for
    // the viewport center until a real position comes in.
    const tx = (mouseX ?? innerWidth / 2) + OFFSET_X;
    const ty = (mouseY ?? innerHeight / 2) + OFFSET_Y;
    cursorX += (tx - cursorX) * 0.07;
    cursorY += (ty - cursorY) * 0.07;
  } else {
    [cursorX, cursorY] = periodSpot();
  }
  cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
  requestAnimationFrame(animate);
}
animate();
