// Build the link-preview card by downscaling a provenanced product capture.
// The source must match its recorded hash, so the preview can never drift away
// from a screenshot that `npm run screenshots` actually produced.
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const SOURCE = 'live-board.jpg';
const WIDTH = 1200;
const HEIGHT = 675;
const SHOTS = new URL('../assets/shots/', import.meta.url);
const OUT = new URL('../assets/og.jpg', import.meta.url);

const manifest = JSON.parse(await readFile(new URL('capture.json', SHOTS), 'utf8'));
const entry = manifest.captures.find((capture) => capture.file === SOURCE);
if (!entry) throw new Error(`${SOURCE} is not listed in capture.json`);

const bytes = await readFile(new URL(SOURCE, SHOTS));
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (sha256 !== entry.sha256) {
  throw new Error(`${SOURCE} does not match its recorded hash; re-run npm run screenshots`);
}

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
try {
  const page = await browser.newPage();
  const encoded = await page.evaluate(async ([data, width, height]) => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${data}`;
    await image.decode();
    if (image.naturalWidth / image.naturalHeight !== width / height) {
      throw new Error(`Source aspect ratio is ${image.naturalWidth}x${image.naturalHeight}; cropping would misrepresent the capture`);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, [bytes.toString('base64'), WIDTH, HEIGHT]);
  await writeFile(OUT, Buffer.from(encoded, 'base64'));
  console.log(`assets/og.jpg ← ${SOURCE} (${WIDTH}x${HEIGHT})`);
} finally {
  await browser.close();
}
