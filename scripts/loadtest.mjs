// Cold-load performance test: measures what a first-time visitor experiences.
// Every run uses a brand-new browser profile (empty cache) and emulates two
// network profiles plus an unthrottled baseline.
//
//   npm run perf                  -> tests https://getpeeky.ai
//   npm run perf http://localhost:8080   -> tests a local preview
//
// First run downloads a headless Chrome build (~80MB) into .perf-browser/
// (gitignored); later runs reuse it.

import puppeteer from 'puppeteer-core';
import {
  install,
  computeExecutablePath,
  detectBrowserPlatform,
  resolveBuildId,
  getInstalledBrowsers,
  Browser,
} from '@puppeteer/browsers';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const URL_TO_TEST = process.argv[2] || 'https://getpeeky.ai/';
const cacheDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.perf-browser');

// Reuse an installed headless shell if present; otherwise fetch stable.
async function browserPath() {
  const installed = await getInstalledBrowsers({ cacheDir });
  const shell = installed.find((b) => b.browser === Browser.CHROMEHEADLESSSHELL);
  if (shell) {
    return computeExecutablePath({ browser: shell.browser, buildId: shell.buildId, cacheDir });
  }
  console.log('First run: downloading headless Chrome into .perf-browser/ ...');
  const platform = detectBrowserPlatform();
  const buildId = await resolveBuildId(Browser.CHROMEHEADLESSSHELL, platform, 'stable');
  await install({ browser: Browser.CHROMEHEADLESSSHELL, buildId, cacheDir });
  return computeExecutablePath({ browser: Browser.CHROMEHEADLESSSHELL, buildId, cacheDir });
}

// Throughput numbers are bytes/second; profiles mirror Lighthouse presets.
const PROFILES = [
  { name: 'Office wifi / broadband (10 Mbps, 40ms RTT)', down: (10240 * 1024) / 8, up: (5120 * 1024) / 8, latency: 40, cpu: 1 },
  { name: 'Phone on weak 4G (1.6 Mbps, 150ms RTT, 4x CPU)', down: (1638 * 1024) / 8, up: (750 * 1024) / 8, latency: 150, cpu: 4 },
  { name: 'Unthrottled baseline', down: -1, up: -1, latency: 0, cpu: 1 },
];

const executablePath = await browserPath();
const browser = await puppeteer.launch({ executablePath, args: ['--mute-audio'] });

console.log(`\nCold-load test: ${URL_TO_TEST}\n`);

for (const p of PROFILES) {
  const ctx = await browser.createBrowserContext(); // fresh profile = empty cache
  const page = await ctx.newPage();
  await page.setViewport({ width: 1400, height: 900 });
  await page.evaluateOnNewDocument(() => {
    window.__lcp = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  const cdp = await page.createCDPSession();
  if (p.down > 0) {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: p.down,
      uploadThroughput: p.up,
      latency: p.latency,
    });
  }
  if (p.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpu });

  await page.goto(URL_TO_TEST, { waitUntil: 'load', timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2500)); // let LCP settle

  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const res = performance.getEntriesByType('resource');
    const bytes = res.reduce((s, r) => s + (r.transferSize || 0), 0) + (nav.transferSize || 0);
    return {
      ttfb: Math.round(nav.responseStart),
      fcp: fcp ? Math.round(fcp.startTime) : null,
      lcp: Math.round(window.__lcp),
      load: Math.round(nav.loadEventEnd),
      requests: res.length + 1,
      transferredKB: Math.round(bytes / 1024),
    };
  });

  console.log(p.name);
  console.log(`  server response ${m.ttfb}ms | first paint ${m.fcp}ms | hero visible (LCP) ${m.lcp}ms | fully loaded ${m.load}ms`);
  console.log(`  ${m.requests} requests, ${m.transferredKB}KB transferred\n`);
  await ctx.close();
}

await browser.close();

console.log('Reference (Google "good" thresholds): LCP < 2500ms, FCP < 1800ms, TTFB < 800ms');
