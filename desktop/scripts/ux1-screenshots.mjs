import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', '..', 'docs', 'ux1-screenshots');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.UX1_BASE || 'http://127.0.0.1:4173';

async function shot(page, name) {
  const path = join(OUT, name);
  await page.screenshot({ path, type: 'png' });
  console.log('wrote', path);
}

async function goto(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1200);
}

async function main() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--disable-gpu', '--force-device-scale-factor=1'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
  page.setDefaultTimeout(30000);

  await goto(page, BASE);
  await page.evaluate(() => {
    sessionStorage.clear();
  });
  await goto(page, BASE);
  await page.getByText(/WELCOME TO THE/i).waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  await shot(page, 'after-welcome.png');

  await page.getByRole('button', { name: /start innovating/i }).click();
  await page.getByText(/WELCOME TO PRISM/i).waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  await shot(page, 'after-login.png');

  await page.locator('[data-node-id="433:1965"] button[type="submit"]').click();
  await page.waitForTimeout(900);
  await shot(page, 'after-conversation.png');

  await page.evaluate(() => {
    sessionStorage.setItem('prism.splash.seen', '1');
    sessionStorage.setItem('prism.auth.seen', '1');
  });
  await goto(page, `${BASE}/welcome`);
  await page.getByText(/New Agent|Search Files|Add Folder/i).first().waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  await shot(page, 'after-ide-welcome.png');

  await browser.close();
  writeFileSync(
    join(OUT, 'README.md'),
    '# UX-1 screenshots\n\nAfter captures from production preview (`npm run preview`).\n\nBefore: see `docs/UX1_SHELL_COMPLETION.md` (pre-UX-1 had no Login gate; `/` was EditorWelcome).\n',
  );
  console.log('done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
