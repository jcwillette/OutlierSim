/**
 * Browser smoke test: every registered game loads, a match starts and runs with bots, the HUD
 * updates, and there are no page errors. Screenshots go to test-results/<game>.png.
 *
 *   npm run test:e2e      (builds first; needs Playwright + Chromium)
 *
 * In the cloud container Playwright/Chromium are preinstalled globally. CI installs them.
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const PORT = 4179;
const BASE = `http://localhost:${PORT}`;
const OUT = path.join(__dirname, '..', '..', 'test-results');

(async () => {
  const { preview } = await import('vite');
  const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'error' });
  const browser = await chromium.launch({
    // Software WebGL so this works headless without a GPU.
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  fs.mkdirSync(OUT, { recursive: true });
  let failed = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`${BASE}/?dev=1`);
    await page.waitForSelector('select[aria-label="Game"] option', { state: 'attached' });
    const ids = await page.$$eval('select[aria-label="Game"] option', (os) => os.map((o) => o.value));
    if (!ids.length) throw new Error('no games in menu');
    for (const id of ids) {
      const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const errors = [];
      p.on('pageerror', (e) => errors.push(String(e)));
      p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await p.goto(`${BASE}/?dev=1&game=${encodeURIComponent(id)}`);
      await p.waitForSelector('button.primary');
      const selected = await p.$eval('select[aria-label="Game"]', (s) => s.value);
      await p.click('button.primary');
      // Wait for the match to really start and the clock to tick. Software WebGL on CI runners can be
      // slow, so wait on state instead of fixed sleeps.
      await p.waitForFunction(
        () => document.querySelector('.clock .phase')?.textContent !== 'pre-match',
        null,
        {
          timeout: 60_000,
        },
      );
      const t0 = await p.$eval('.clock .time', (e) => e.textContent);
      await p.keyboard.down('KeyW');
      await p.waitForFunction((t) => document.querySelector('.clock .time')?.textContent !== t, t0, {
        timeout: 60_000,
      });
      await p.keyboard.up('KeyW');
      const time = await p.$eval('.clock .time', (e) => e.textContent);
      const phase = await p.$eval('.clock .phase', (e) => e.textContent);
      const scores = await p.$$eval('.scorebar .score', (es) => es.map((e) => Number(e.textContent)));
      await p.screenshot({ path: path.join(OUT, `${id}.png`) });
      const ok = selected === id && errors.length === 0 && phase !== 'pre-match' && scores.length === 2;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: phase=${phase} time=${time} score=${scores.join('-')}`);
      if (!ok) {
        failed++;
        if (selected !== id) console.log(`  ?game= selected '${selected}'`);
        for (const e of errors) console.log(`  error: ${e}`);
      }
      await p.close();
    }
  } finally {
    await browser.close();
    await new Promise((r) => server.httpServer.close(r));
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
