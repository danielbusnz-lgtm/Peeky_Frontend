// "The grind vs. the voice" — an original kinetic type film for Peeky.
// Dark, rhythmic, cut on a 120 BPM beat grid (beat = 0.5s) so any
// 120 BPM instrumental can be laid underneath and lock to the motion.
// Renders 1920x1080@30fps frames -> /tmp/film, assemble with ffmpeg.
import puppeteer from 'puppeteer-core';
import { computeExecutablePath, getInstalledBrowsers, Browser } from '@puppeteer/browsers';
import { readFileSync, mkdirSync } from 'node:fs';

const FPS = 30;
const DUR = 34; // seconds, 68 beats at 120bpm
mkdirSync('/tmp/film', { recursive: true });

const cursorUri = 'data:image/svg+xml;base64,' + readFileSync('cursor.svg').toString('base64');

const html = `<!doctype html><html><head><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1920px; height: 1080px; overflow: hidden; background: #06080c;
         font-family: -apple-system, ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  #stage { position: absolute; inset: 0; }
  .word { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
          color: #e5e7eb; font-weight: 600; letter-spacing: -0.02em; white-space: nowrap; }
  .mono { font-family: ui-monospace, Menlo, monospace; font-weight: 500; letter-spacing: 0; }
  .pill { position: absolute; display: inline-flex; align-items: center; gap: .5em;
          padding: .6em 1.1em; border-radius: 9999px; font-size: 54px; font-weight: 600;
          letter-spacing: -.01em; white-space: nowrap; color: #fff;
          background: rgba(17, 24, 39, 0.92);
          box-shadow: inset 2px 2px 2px rgba(255,255,255,.28), 0 18px 60px rgba(0,0,0,.6); }
  .pill.blue { background: rgba(0, 100, 216, 0.95);
               box-shadow: inset 2px 2px 2px rgba(255,255,255,.4), 0 18px 60px rgba(0,120,254,.35); }
  .pill img { width: 1.05em; height: 1.05em; display: block; }
  .dot { position: absolute; width: 22px; height: 22px; border-radius: 50%; background: #fd8a02;
         box-shadow: 0 0 24px rgba(253,138,2,.8); }
  .trail { position: absolute; border-radius: 50%; background: #fd8a02; }
  .ring { position: absolute; border: 3px solid rgba(253,138,2,.8); border-radius: 50%; }
  .panel { position: absolute; border-radius: 14px; background: rgba(229,231,235,.06);
           border: 1px solid rgba(229,231,235,.14); }
  .panel.lit { background: rgba(253,138,2,.10); border-color: rgba(253,138,2,.55); }
</style></head><body><div id="stage"></div>
<script>
const clamp = (v) => Math.max(0, Math.min(1, v));
const ez = (v) => 1 - Math.pow(1 - clamp(v), 3);           // ease-out cubic
const ezi = (v) => { v = clamp(v); return v < .5 ? 2*v*v : 1 - Math.pow(-2*v + 2, 2)/2; };
const BEAT = 0.5;

// ---- scene 1: the grind (0-8s, 16 beats) ----
const S1A = ['9:04 AM','47 clicks','12 menus','6 apps','"where was that setting?"','copy','paste','repeat','another tab','another menu','another search','your hands are tired'];
function grind(t) {
  let h = '';
  const beat = t / BEAT;
  if (beat < 12) {
    const i = Math.floor(beat);
    const bt = beat - i;
    const scale = 1 + 0.07 * (1 - ez(bt * 2));
    const size = i < 4 ? 150 : 96;
    h += '<div class="word mono" style="font-size:' + size + 'px;transform:translate(-50%,-50%) scale(' + scale + ')">' + S1A[i] + '</div>';
  } else if (beat < 15.5) {
    // double-time flicker: click click click...
    const half = Math.floor((beat - 12) * 2);
    const x = [38, 62, 45, 58, 50, 42, 55][half % 7];
    const y = [40, 55, 62, 38, 50, 58, 44][half % 7];
    h += '<div class="word mono" style="font-size:120px;left:' + x + '%;top:' + y + '%">click</div>';
  } else {
    const bt = (beat - 15.5) / 0.5;
    h += '<div class="word" style="font-size:170px;opacity:' + ez(bt) + '">stop.</div>';
  }
  return h;
}

// ---- scene 2: the ask (8-13s) ----
function ask(t) {
  const words = 'Make a note to call mom at 9pm'.split(' ');
  const n = Math.max(1, Math.min(words.length, Math.floor(t / 0.25) + 1));
  const pop = 1 + 0.05 * (1 - ez((t % 0.25) * 6));
  const appear = ez(t * 3);
  return '<div class="pill" style="left:50%;top:50%;transform:translate(-50%,-50%) scale(' + (appear * pop) + ')">' +
    words.slice(0, n).join(' ') + '</div>';
}

// ---- scene 3: the cursor (13-19s, 12 beats) ----
const PTS = [[420,760],[1180,300],[1560,720],[760,880],[1320,520],[480,360]];
const PANELS = [[300,640,340,200],[1040,200,360,220],[1420,620,320,200],[620,790,330,180],[1180,420,340,200],[340,260,330,200]];
function cursorScene(t) {
  let h = '';
  const beat = t / BEAT;          // 0..12, hop every 2 beats
  const seg = Math.min(4, Math.floor(beat / 2));
  const segT = ezi((beat - seg * 2) / 2);
  const [x0, y0] = PTS[seg], [x1, y1] = PTS[seg + 1];
  const x = x0 + (x1 - x0) * segT, y = y0 + (y1 - y0) * segT;
  // panels: all faint; lit once visited
  PANELS.forEach((p, i) => {
    const lit = i <= seg && (i < seg || segT > 0.9) ? ' lit' : '';
    h += '<div class="panel' + lit + '" style="left:' + p[0] + 'px;top:' + p[1] + 'px;width:' + p[2] + 'px;height:' + p[3] + 'px"></div>';
  });
  // trail: previous positions, fading
  for (let k = 1; k <= 10; k++) {
    const tt = Math.max(0, t - k * 0.03);
    const b2 = tt / BEAT;
    const s2 = Math.min(4, Math.floor(b2 / 2));
    const st2 = ezi((b2 - s2 * 2) / 2);
    const [a0, b0] = PTS[s2], [a1, b1] = PTS[s2 + 1];
    const tx = a0 + (a1 - a0) * st2, ty = b0 + (b1 - b0) * st2;
    const sz = 18 - k * 1.5;
    h += '<div class="trail" style="left:' + (tx - sz / 2) + 'px;top:' + (ty - sz / 2) + 'px;width:' + sz + 'px;height:' + sz + 'px;opacity:' + (0.5 - k * 0.05) + '"></div>';
  }
  // click ripple at each landed point, expanding over the beat after arrival
  for (let i = 1; i <= seg + (segT > 0.97 ? 1 : 0) && i <= 5; i++) {
    const arrive = i * 2 * BEAT * 2 / 2; // arrival time of point i = i*1s... hops are 1s (2 beats)
  }
  const rippleT = (t % 1);
  if (segT > 0.92 || segT < 0.08) {
    const cx = segT > 0.92 ? x1 : x0, cy = segT > 0.92 ? y1 : y0;
    const rp = segT > 0.92 ? (segT - 0.92) / 0.4 : (0.5 + segT * 3);
    const r = 20 + ez(rp) * 90;
    h += '<div class="ring" style="left:' + (cx - r) + 'px;top:' + (cy - r) + 'px;width:' + (2 * r) + 'px;height:' + (2 * r) + 'px;opacity:' + (1 - clamp(rp)) + '"></div>';
  }
  h += '<div class="dot" style="left:' + (x - 11) + 'px;top:' + (y - 11) + 'px"></div>';
  return h;
}

// ---- scene 4: call and response (19-27s, 16 beats) ----
const QA = [
  { q: 'Open my lease agreement', a: 'Opening it now' },
  { q: "What's the monthly rent?", a: '$2,450 a month' },
  { q: 'Pull up recent news', a: 'Sure, here you go' },
  { q: 'Send that to mom', a: 'Sent' },
];
function qa(t) {
  const pair = Math.min(3, Math.floor(t / 2));     // each pair: 4 beats = 2s
  const pt = t - pair * 2;
  const { q, a } = QA[pair];
  const qIn = ez(pt * 4);
  const aIn = ez((pt - 0.5) * 4);
  const side = pair % 2 === 0;
  let h = '<div class="pill" style="' + (side ? 'left:18%' : 'right:18%;left:auto') + ';top:38%;opacity:' + qIn + ';transform:scale(' + (0.94 + qIn * 0.06) + ')">' + q + '</div>';
  if (pt > 0.5) {
    h += '<div class="pill blue" style="' + (side ? 'left:26%' : 'right:26%;left:auto') + ';top:54%;opacity:' + aIn + ';transform:scale(' + (0.94 + aIn * 0.06) + ')"><img src="${cursorUri}">' + a + '</div>';
  }
  return h;
}

// ---- scene 5: resolve (27-34s) ----
function resolve(t) {
  const words = ['Control', 'your', 'Mac', 'just', 'by', 'talking'];
  let line = '';
  words.forEach((w, i) => {
    const p = ez((t - i * 0.25) / 0.5);
    line += '<span style="display:inline-block;opacity:' + p + ';transform:translateY(' + (1 - p) * 40 + 'px)">' + w + '</span> ';
  });
  const dotP = ez((t - 1.6) / 0.3);
  const dotPop = 1 + 0.6 * (1 - ez((t - 1.6) / 0.45));
  line += '<span style="display:inline-block;color:#fd8a02;opacity:' + dotP + ';transform:scale(' + (dotP ? dotPop : 0) + ')">.</span>';
  const subP = ez((t - 2.4) / 0.6);
  const urlP = ez((t - 3.0) / 0.6);
  const fade = 1 - ez((t - 6.0) / 1.0);
  return '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:54px;opacity:' + fade + '">' +
    '<div style="font-size:108px;font-weight:600;letter-spacing:-0.025em;color:#f9fafb">' + line + '</div>' +
    '<div style="font-size:38px;font-weight:500;color:#9ca3af;opacity:' + subP + ';transform:translateY(' + (1 - subP) * 16 + 'px)">Open source. Free. Any app.</div>' +
    '<div class="pill blue" style="position:static;font-size:44px;opacity:' + urlP + ';transform:translateY(' + (1 - urlP) * 16 + 'px)"><img src="${cursorUri}">getpeeky.ai</div></div>';
}

window.setFrame = (t) => {
  let h = '';
  if (t < 8) h = grind(t);
  else if (t < 13) h = ask(t - 8);
  else if (t < 19) h = cursorScene(t - 13);
  else if (t < 27) h = qa(t - 19);
  else h = resolve(t - 27);
  document.getElementById('stage').innerHTML = h;
};
</script></body></html>`;

const cacheDir = process.cwd() + '/.perf-browser';
const shell = (await getInstalledBrowsers({ cacheDir })).find((b) => b.browser === Browser.CHROMEHEADLESSSHELL);
const executablePath = computeExecutablePath({ browser: shell.browser, buildId: shell.buildId, cacheDir });
const browser = await puppeteer.launch({ executablePath });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.setContent(html);

const total = DUR * FPS;
for (let f = 0; f < total; f++) {
  await page.evaluate((t) => window.setFrame(t), f / FPS);
  await page.screenshot({ path: `/tmp/film/f_${String(f).padStart(4, '0')}.png`, type: 'png' });
  if (f % 120 === 0) console.log(`frame ${f}/${total}`);
}
await browser.close();
console.log('frames done');
