// Renders scripts/og-card.html into og-image.jpg (1200x630 @2x) at the
// repo root. Reuses the .perf-browser headless Chrome from the perf rig.
//
//   node scripts/og-render.mjs

import puppeteer from 'puppeteer-core';
import {
  computeExecutablePath,
  getInstalledBrowsers,
  install,
  detectBrowserPlatform,
  resolveBuildId,
  Browser,
} from '@puppeteer/browsers';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const cacheDir = path.join(here, '..', '.perf-browser');

const installed = await getInstalledBrowsers({ cacheDir });
let shell = installed.find((b) => b.browser === Browser.CHROMEHEADLESSSHELL);
if (!shell) {
  const platform = detectBrowserPlatform();
  const buildId = await resolveBuildId(Browser.CHROMEHEADLESSSHELL, platform, 'stable');
  await install({ browser: Browser.CHROMEHEADLESSSHELL, buildId, cacheDir });
  shell = { browser: Browser.CHROMEHEADLESSSHELL, buildId };
}
const executablePath = computeExecutablePath({ browser: shell.browser, buildId: shell.buildId, cacheDir });

const browser = await puppeteer.launch({ executablePath });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });
await page.goto('file://' + path.join(here, 'og-card.html'), { waitUntil: 'networkidle0' });
await page.screenshot({
  path: path.join(here, '..', 'og-image.jpg'),
  type: 'jpeg',
  quality: 88,
});
await browser.close();
console.log('Wrote og-image.jpg (2400x1260)');
