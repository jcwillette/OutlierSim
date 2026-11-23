/**
 * Browser smoke test: every registered game loads, a match starts and runs with bots, the HUD
 * updates, and there are no page errors. Each game is also watched in spectator mode (six bots,
 * fast-forward, follow a robot). Screenshots go to test-results/<game>.png and <game>-watch.png.
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
        // The HUD appears only once physics has loaded, so require it to exist (a missing element
        // would otherwise satisfy "not pre-match" immediately).
        () => {
          const phase = document.querySelector('.clock .phase')?.textContent;
          return !!phase && phase !== 'pre-match';
        },
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

      // Spectator mode: six bots, fast-forward, follow another robot.
      const w = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const werrors = [];
      w.on('pageerror', (e) => werrors.push(String(e)));
      w.on('console', (m) => m.type() === 'error' && werrors.push(m.text()));
      await w.goto(`${BASE}/?dev=1&watch=1&game=${encodeURIComponent(id)}`);
      await w.waitForSelector('button.primary');
      const label = await w.$eval('button.primary', (b) => b.textContent);
      // Alliance composition: pick the game's first lineup preset for blue, if it has any.
      const presets = await w.$$eval('select[aria-label="blue alliance preset"] option', (os) =>
        os.map((o) => o.value),
      );
      const preset = presets.find((v) => v !== 'random' && v !== 'custom');
      if (preset) {
        await w.selectOption('select[aria-label="blue alliance preset"]', preset);
        await w.waitForSelector('button.primary');
      }
      await w.click('button.primary');
      await w.waitForFunction(
        // The HUD appears only once physics has loaded, so require it to exist (a missing element
        // would otherwise satisfy "not pre-match" immediately).
        () => {
          const phase = document.querySelector('.clock .phase')?.textContent;
          return !!phase && phase !== 'pre-match';
        },
        null,
        { timeout: 60_000 },
      );
      await w.keyboard.press('BracketRight');
      await w.keyboard.press('BracketRight');
      await w.keyboard.press('Digit4');
      const w0 = await w.$eval('.clock .time', (e) => e.textContent);
      await w.waitForFunction((t) => document.querySelector('.clock .time')?.textContent !== t, w0, {
        timeout: 60_000,
      });
      const following = await w.$eval('.status .name', (e) => e.textContent);
      const players = await w.evaluate(() => {
        const s = globalThis.outlierSim.session;
        return s.player === null && s.brains.size === 6 ? 0 : 1;
      });
      await w.screenshot({ path: path.join(OUT, `${id}-watch.png`) });
      const wok =
        label === 'Watch match' &&
        werrors.length === 0 &&
        following.startsWith('Following Red 1') &&
        players === 0;
      console.log(
        `${wok ? 'PASS' : 'FAIL'} ${id} (watch${preset ? `, blue=${preset}` : ''}): ${following}, non-bot robots=${players}`,
      );
      if (!wok) {
        failed++;
        if (label !== 'Watch match') console.log(`  ?watch=1 did not select watch mode (button '${label}')`);
        for (const e of werrors) console.log(`  error: ${e}`);
      }
      await w.close();
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
