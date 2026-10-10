import { chromium } from 'playwright';
import { startServer } from './server.mjs';

const server = await startServer();
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  // Keep link previews focused on the real stacked boards, not the room illustration.
  await page.evaluate(() => {
    const brand = document.querySelector('.site-header .brand').cloneNode(true);
    document.querySelector('.hero-copy').prepend(brand);
    document.querySelector('.hero .room-demo').replaceWith(document.querySelector('.hero-stage'));
    document.querySelector('.hero-lede').textContent = 'Live scoreboards. Gallery-worthy art. A room that celebrates with you.';
  });
  await page.addStyleTag({ content: `
    .site-header, .hero-footer, .hero .eyebrow, .hero-actions,
    .hero-followup, .hero-detail, .hero-note, .stage-label { display: none; }
    .hero { width: 1200px; height: 630px; }
    .hero-grid {
      width: 1104px; height: 630px; min-height: 0; padding: 0;
      grid-template-columns: 400px 684px; gap: 20px; align-items: center;
    }
    .hero-copy .brand { margin-bottom: 38px; font-size: 36px; }
    .hero-copy { align-self: center; }
    .hero-copy .brand img { width: 44px; height: 44px; }
    .hero h1 { font-size: 80px; line-height: .94; margin-top: 0; }
    .hero-lede { width: 325px; margin-top: 27px; font-size: 18px; }
    .hero-stage { height: 530px; grid-column: 2; grid-row: 1; }
    .screen-mini { top: 10px; right: 53px; width: 48%; opacity: 1; }
    .screen-main { top: 134px; left: 0; width: 96%; }
    .screen-art { bottom: 7px; left: -29px; width: 59%; }
    .hero-screen figcaption { font-size: 10px; }
    .screen-bar { font-size: 8px; }
  ` });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('.hero img')].map((image) => image.decode()));
  });
  if (errors.length) throw new Error(errors.join('\n'));
  const imageUrl = await page.locator('meta[property="og:image"]').getAttribute('content');
  const filename = new URL(imageUrl).pathname.split('/').at(-1);
  if (!/^stadiate-stacked-boards-v\d+\.jpg$/.test(filename)) {
    throw new Error(`Unexpected social card filename: ${filename}`);
  }
  await page.locator('.hero').screenshot({
    path: new URL(`../assets/${filename}`, import.meta.url).pathname,
    type: 'jpeg', quality: 92,
  });
  console.log(`Generated assets/${filename} (1200 x 630) from the site's stacked boards.`);
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
