const form = document.getElementById('waitlist');
const email = document.getElementById('email');
const msg = document.getElementById('formMsg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = email.value.trim();
  if (!value || !email.checkValidity()) {
    msg.textContent = 'Enter a valid email';
    return;
  }

  email.disabled = true;
  try {
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: value }),
    });
    if (!res.ok) throw new Error(await res.text());
    email.value = '';
    msg.textContent = "You're on the list.";
  } catch {
    msg.textContent = 'Something went wrong, try again.';
  } finally {
    email.disabled = false;
  }
});

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

// Orange cursor that eases toward the real pointer with a slight lag.
const cursor = document.getElementById('cursor');
let mouseX = -100, mouseY = -100;
let cursorX = -100, cursorY = -100;

// Offset from the real pointer: positive X moves right, negative Y moves up.
const OFFSET_X = 16;
const OFFSET_Y = -20;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

function animate() {
  cursorX += (mouseX - cursorX) * 0.07;
  cursorY += (mouseY - cursorY) * 0.07;
  cursor.style.transform = `translate(${cursorX + OFFSET_X}px, ${cursorY + OFFSET_Y}px)`;
  requestAnimationFrame(animate);
}
animate();
