// Computes the visual centroid of the cursor glyph and prints a square
// viewBox centered on it (sized to contain the full glyph, small padding).
import puppeteer from 'puppeteer-core';
import { computeExecutablePath, getInstalledBrowsers, Browser } from '@puppeteer/browsers';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.join(here, '..', '.perf-browser');
const shell = (await getInstalledBrowsers({ cacheDir })).find((b) => b.browser === Browser.CHROMEHEADLESSSHELL);
const executablePath = computeExecutablePath({ browser: shell.browser, buildId: shell.buildId, cacheDir });

const browser = await puppeteer.launch({ executablePath });
const page = await browser.newPage();
await page.goto('about:blank');
const { readFileSync } = await import('node:fs');
const svgDataUri = 'data:image/svg+xml;base64,' +
  readFileSync(path.join(here, '..', 'cursor.svg')).toString('base64');

const r = await page.evaluate(async (src) => {
  const SCALE = 20; // rasterize 42x42 svg at 840x840 for precision
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = 42 * SCALE;
  c.height = 42 * SCALE;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let sx = 0, sy = 0, n = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const a = d[(y * c.width + x) * 4 + 3];
      if (a > 10) {
        sx += x * a; sy += y * a; n += a;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const cx = sx / n / SCALE, cy = sy / n / SCALE;
  return {
    cx, cy,
    minX: minX / SCALE, maxX: maxX / SCALE,
    minY: minY / SCALE, maxY: maxY / SCALE,
  };
}, svgDataUri);
await browser.close();

const PAD = 0.8;
const half = Math.max(r.cx - r.minX, r.maxX - r.cx, r.cy - r.minY, r.maxY - r.cy) + PAD;
const f = (v) => v.toFixed(2);
console.log(`centroid: ${f(r.cx)}, ${f(r.cy)}  bounds: x ${f(r.minX)}..${f(r.maxX)}  y ${f(r.minY)}..${f(r.maxY)}`);
console.log(`viewBox="${f(r.cx - half)} ${f(r.cy - half)} ${f(half * 2)} ${f(half * 2)}"`);
