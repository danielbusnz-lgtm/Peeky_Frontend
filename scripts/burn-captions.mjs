// Renders every caption state of the lease demo as transparent PNGs
// (site-faithful pill styling) and emits an ffmpeg command that burns
// them onto DemoV3.mp4 with the website's word-reveal timing.
// Run from the Peeky_Frontend repo root: node /tmp/pill-burn/gen.mjs

import puppeteer from 'puppeteer-core';
import { computeExecutablePath, getInstalledBrowsers, Browser } from '@puppeteer/browsers';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';

const OUT = '/tmp/pill-burn';
mkdirSync(OUT, { recursive: true });

// Raw-clip times: the production timeline minus the 1.5s freeze pad.
const CAPTIONS = [
  { start: 0.95,  end: 3.0,   who: 'user',  text: 'Can you open up my lease agreement?' },
  { start: 3.68,  end: 5.6,   who: 'peeky', text: 'Opening it up now', thinkAt: 3.0 },
  { start: 5.7,   end: 7.9,   who: 'user',  text: "What's the monthly rent?" },
  { start: 8.78,  end: 11.23, who: 'peeky', text: "Found it, it's $2,450 a month", thinkAt: 7.9 },
  { start: 11.33, end: 13.64, who: 'user',  text: 'Is there a section about pets?' },
  { start: 14.6,  end: 15.8,  who: 'peeky', text: 'Yes, right here', thinkAt: 13.64 },
];

// Video is 3320px wide; the site stage is ~1120px with ~21px pill text.
// Scale everything by ~2.96 so the burned pill matches the web look.
const FONT = 64;

const cursorSvg = readFileSync('cursor.svg', 'utf8');
const cursorUri = 'data:image/svg+xml;base64,' + Buffer.from(cursorSvg).toString('base64');

const pageHtml = `<!doctype html><html><head><style>
  body { margin: 0; background: transparent; font-family: -apple-system, ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  #wrap { display: inline-block; padding: 60px; }
  .pill {
    display: inline-flex; align-items: center; gap: .5em;
    padding: .6em 1.1em; border-radius: 9999px;
    font-size: ${FONT}px; font-weight: 600; letter-spacing: -.01em; white-space: nowrap;
    color: #fff; text-shadow: 0 2px 5px rgba(0,0,0,.35);
    background: rgba(17, 24, 39, 0.75);
    box-shadow:
      inset 2px 2px 2px rgba(255,255,255,.4),
      0 18px 50px rgba(0,0,0,.35);
  }
  .pill.peeky { background: rgba(0, 100, 216, 0.82); }
  .pill img { width: 1.05em; height: 1.05em; display: block; }
  .dots { display: flex; align-items: center; gap: .32em; padding: .22em .15em; }
  .dots i { width: .4em; height: .4em; border-radius: 50%; background: currentColor; opacity: .75; }
</style></head><body><div id="wrap"></div></body></html>`;

const cacheDir = process.cwd() + '/.perf-browser';
const shell = (await getInstalledBrowsers({ cacheDir })).find((b) => b.browser === Browser.CHROMEHEADLESSSHELL);
const executablePath = computeExecutablePath({ browser: shell.browser, buildId: shell.buildId, cacheDir });
const browser = await puppeteer.launch({ executablePath });
const page = await browser.newPage();
await page.setViewport({ width: 3400, height: 600 });
await page.setContent(pageHtml);

const overlays = []; // { png, start, end }
let idx = 0;

async function shoot(html, start, end) {
  const file = `${OUT}/cap_${String(idx++).padStart(2, '0')}.png`;
  await page.evaluate((h) => { document.getElementById('wrap').innerHTML = h; }, html);
  const el = await page.$('#wrap');
  await el.screenshot({ path: file, omitBackground: true });
  overlays.push({ png: file, start, end });
}

for (const c of CAPTIONS) {
  const icon = c.who === 'peeky' ? `<img src="${cursorUri}">` : '';
  const peeky = c.who === 'peeky' ? ' peeky' : '';
  if (c.thinkAt !== undefined) {
    await shoot(
      `<div class="pill${peeky}">${icon}<span class="dots"><i></i><i></i><i></i></span></div>`,
      c.thinkAt, c.start
    );
  }
  // Website reveal pacing: words over the first 55% of the window, capped 1.5s.
  const words = c.text.split(' ');
  const reveal = Math.min((c.end - c.start) * 0.55, 1.5);
  for (let k = 1; k <= words.length; k++) {
    const sliceStart = c.start + (reveal * (k - 1)) / words.length;
    const sliceEnd = k === words.length ? c.end : c.start + (reveal * k) / words.length;
    await shoot(
      `<div class="pill${peeky}">${icon}<span>${words.slice(0, k).join(' ')}</span></div>`,
      sliceStart, sliceEnd
    );
  }
}
await browser.close();

// Build the ffmpeg command: chain one overlay per state, centered, top 7%.
// The 60px wrap padding offsets shadow bleed: x/y compensate by centering on w/h.
const inputs = overlays.map((o) => `-i "${o.png}"`).join(' ');
let chain = '';
let prev = '0:v';
overlays.forEach((o, i) => {
  const label = i === overlays.length - 1 ? 'vout' : `v${i + 1}`;
  chain += `[${prev}][${i + 1}:v]overlay=x=(W-w)/2:y=H*0.07-60:enable='between(t,${o.start.toFixed(3)},${o.end.toFixed(3)})'[${label}];`;
  prev = label;
});
chain = chain.slice(0, -1);

const cmd = `ffmpeg -y -i "/Users/danielbrooks/Documents/DemoV3.mp4" ${inputs} -filter_complex "${chain}" -map "[vout]" -c:v libx264 -crf 18 -preset slow -movflags +faststart "/Users/danielbrooks/Documents/DemoV3_captioned.mp4"`;
writeFileSync(`${OUT}/burn.sh`, cmd + '\n');
console.log(`${overlays.length} overlay states rendered. Run: bash ${OUT}/burn.sh`);
