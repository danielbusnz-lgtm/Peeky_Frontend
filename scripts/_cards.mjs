// Renders the marketing video's title and end cards as 30fps frame
// sequences (1920x1080) using the site's motion language: masked word
// rise for the headline, fades for the rest. Frames -> /tmp/cards/.
import puppeteer from 'puppeteer-core';
import { computeExecutablePath, getInstalledBrowsers, Browser } from '@puppeteer/browsers';
import { readFileSync, mkdirSync } from 'node:fs';

const FPS = 30;
mkdirSync('/tmp/cards/title', { recursive: true });
mkdirSync('/tmp/cards/end', { recursive: true });

const cursorUri = 'data:image/svg+xml;base64,' + readFileSync('cursor.svg').toString('base64');

// ease-out cubic, clamped 0..1
const easeJs = `
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const ease = (v) => 1 - Math.pow(1 - clamp(v), 3);
`;

const html = `<!doctype html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1920px; height: 1080px; overflow: hidden;
    font-family: -apple-system, ui-sans-serif, system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    background: radial-gradient(1400px 800px at 50% 120%, rgba(0,136,255,0.08), transparent 70%), #ffffff;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 56px;
  }
  .brand { display: flex; align-items: center; gap: 18px; font-size: 44px; font-weight: 600; letter-spacing: -0.02em; color: #030712; }
  .brand img { width: 56px; height: 56px; }
  h1 { font-size: 110px; font-weight: 600; letter-spacing: -0.025em; color: #030712; text-align: center; line-height: 1.1; }
  h1 .dot { color: #fd8a02; }
  .mask { display: inline-block; overflow: hidden; padding-bottom: 0.22em; margin-bottom: -0.22em; vertical-align: bottom; }
  .mask span { display: inline-block; }
  .sub { font-size: 40px; font-weight: 500; color: #6b7280; letter-spacing: -0.01em; }
  .url {
    display: inline-flex; align-items: center; gap: 16px;
    padding: 22px 44px; border-radius: 9999px;
    background: linear-gradient(120deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.1) 35%, transparent 55%), #0088ffeb;
    color: #fff; font-size: 44px; font-weight: 600;
    box-shadow: inset 0 2px 2px rgba(255,255,255,0.55), 0 18px 50px rgba(0,136,255,0.35);
  }
  .url img { width: 44px; height: 44px; }
</style></head><body><div id="stage"></div>
<script>
  ${easeJs}
  // Each card defines render(t) that lays out the stage for time t (sec).
  window.cards = {
    title(t) {
      const words = ['Control', 'your', 'Mac', 'just', 'by', 'talking'];
      const wordSpans = words.map((w, i) => {
        const p = ease((t - 0.25 - i * 0.08) / 0.7);
        const y = (1 - p) * 120;
        const last = i === words.length - 1;
        return '<span class="mask"><span style="transform: translateY(' + y + '%)">' + w + (last ? '<span class="dot">.</span>' : '') + '</span></span>';
      }).join(' ');
      const brandP = ease(t / 0.5);
      return '<div style="display:flex;flex-direction:column;align-items:center;gap:56px">' +
        '<div class="brand" style="opacity:' + brandP + '"><img src="${cursorUri}"> Peeky</div>' +
        '<h1>' + wordSpans + '</h1></div>';
    },
    end(t) {
      const p1 = ease(t / 0.6);
      const p2 = ease((t - 0.4) / 0.6);
      const p3 = ease((t - 0.8) / 0.6);
      return '<div style="display:flex;flex-direction:column;align-items:center;gap:48px">' +
        '<h1 style="opacity:' + p1 + ';transform:translateY(' + (1 - p1) * 24 + 'px)">Works where you work<span class="dot">.</span></h1>' +
        '<div class="sub" style="opacity:' + p2 + ';transform:translateY(' + (1 - p2) * 18 + 'px)">Open source. Free. Any app.</div>' +
        '<div class="url" style="opacity:' + p3 + ';transform:translateY(' + (1 - p3) * 18 + 'px)"><img src="${cursorUri}"> getpeeky.ai</div></div>';
    },
  };
  window.setFrame = (card, t) => { document.getElementById('stage').outerHTML = '<div id="stage">' + window.cards[card](t) + '</div>'; };
</script></body></html>`;

const cacheDir = process.cwd() + '/.perf-browser';
const shell = (await getInstalledBrowsers({ cacheDir })).find((b) => b.browser === Browser.CHROMEHEADLESSSHELL);
const executablePath = computeExecutablePath({ browser: shell.browser, buildId: shell.buildId, cacheDir });
const browser = await puppeteer.launch({ executablePath });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.setContent(html);

async function renderCard(name, seconds) {
  const frames = Math.round(seconds * FPS);
  for (let f = 0; f < frames; f++) {
    await page.evaluate((card, t) => window.setFrame(card, t), name, f / FPS);
    await page.screenshot({ path: `/tmp/cards/${name}/f_${String(f).padStart(4, '0')}.png`, type: 'png' });
  }
  console.log(`${name}: ${frames} frames`);
}

await renderCard('title', 2.5);
await renderCard('end', 3.5);
await browser.close();
