const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = process.cwd();
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]);
  const file = path.resolve(root, clean.replace(/^\//, ''));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: edge });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) errors.push(msg.type().toUpperCase() + ': ' + msg.text());
  });

  const url = `http://127.0.0.1:${port}/index.html`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.home-view');
  console.log('title:', await page.title());
  await page.screenshot({ path: path.join(root, 'qa-home-desktop.png'), fullPage: false });

  await page.click('[data-view="rmti"]');
  await page.waitForSelector('#rmti-start-btn');
  await page.click('#rmti-start-btn');
  for (let i = 0; i < 30; i++) {
    await page.waitForSelector('.rmti-option');
    await page.click('.rmti-option');
    await page.waitForTimeout(160);
  }
  await page.click('#rmti-next');
  await page.waitForSelector('.result-type h2');
  console.log('rmti result:', (await page.textContent('.result-type h2')).trim());
  await page.screenshot({ path: path.join(root, 'qa-rmti-result.png'), fullPage: false });
  await page.click('#back-home');
  await page.waitForSelector('.home-view');

  await page.click('[data-view="mirror"]');
  await page.waitForSelector('#oracleCanvas');
  await page.click('#mirrorBtn');
  await page.click('#spinBtn');
  try {
    await page.waitForSelector('#modalOverlay.active', { timeout: 15000 });
  } catch (e) {
    console.log('mirror modal did not open; errors so far:\n' + errors.join('\n'));
    throw e;
  }
  console.log('mirror modal:', (await page.textContent('#modalTitle')).trim());
  await page.screenshot({ path: path.join(root, 'qa-mirror-modal.png'), fullPage: false });
  await page.click('#back-home');
  await page.waitForSelector('.home-view');

  await page.click('[data-view="paradox"]');
  await page.waitForTimeout(12000);
  const hasCanvas = await page.locator('.paradox-app canvas').count();
  const fallback = await page.locator('.paradox-fallback').count();
  console.log('paradox canvas:', hasCanvas, 'fallback:', fallback);
  if (hasCanvas) {
    await page.mouse.click(683, 384);
    await page.waitForTimeout(700);
    console.log('paradox hud:', (await page.textContent('#rule-count')).trim(), (await page.textContent('#censer-text')).trim());
  } else if (fallback) {
    console.log('paradox fallback text:', (await page.textContent('.paradox-fallback')).trim().slice(0, 120));
  }
  await page.screenshot({ path: path.join(root, 'qa-paradox.png'), fullPage: false });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto(url, { waitUntil: 'domcontentloaded' });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  console.log('mobile overflow:', overflow, 'scrollWidth:', await mobile.evaluate(() => document.documentElement.scrollWidth));
  await mobile.screenshot({ path: path.join(root, 'qa-home-mobile.png'), fullPage: false });
  await mobile.close();

  await browser.close();
  server.close();
  if (errors.length) {
    console.log('errors/warnings:\n' + errors.join('\n'));
    process.exitCode = 2;
  }
})().catch(async (e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
