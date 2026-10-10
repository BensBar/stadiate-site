import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { startServer } from './server.mjs';
import { scoreboardFromSummary, playersFromSummary } from './capture-data.mjs';

let server;
let browser;
let base;
const beaconSnippet = `<!-- Cloudflare Web Analytics --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "8c455c544d7e4c3d9ba1a0651cb2ad9a"}'></script><!-- End Cloudflare Web Analytics -->`;
// Keep tests hermetic: stub the analytics beacon so nothing is sent to Cloudflare.
async function newPage(options) {
  const page = await browser.newPage(options);
  await page.route(/^https:\/\/([a-z.]+\.)?cloudflareinsights\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  return page;
}
before(async () => {
  server = await startServer();
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('responsive page has no overflow, missing images, script errors, or broken anchors', async () => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    const height = width < 768 ? 812 : 900;
    const page = await newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    try {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
      await page.goto(base);
      await page.evaluate(async () => {
        for (const image of document.querySelectorAll('img[src]')) image.loading = 'eager';
        await document.fonts.ready;
        await Promise.all([...document.querySelectorAll('img[src]')].map((image) => image.decode()));
      });
      assert.equal(await page.locator('h1').count(), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px`);
      assert.deepEqual(await page.locator('a[href^="#"]').evaluateAll((links) =>
        links.filter((link) => !document.getElementById(link.hash.slice(1))).map((link) => link.hash)), []);
      assert.deepEqual(errors, [], `Browser errors at ${width}px`);
      assert.equal(await page.locator('#comparison tbody tr').count(), 12);
      assert.match(await page.locator('#fantasy').textContent(), /Mac server feature/);
      assert.match(await page.locator('#fantasy').textContent(), /EXPERIMENTAL/);
      assert.match(await page.locator('.screen-art figcaption').textContent(), /Frame TV art\. For sports fans\./);
      assert.equal(await page.locator('.hero #room-demo').count(), 1);
      assert.equal(await page.locator('.room-scene image').count(), 3);
      const scene = await page.locator('.room-scene').boundingBox();
      assert.ok(scene.y + scene.height <= height, `Entire room must be visible on arrival at ${width}px`);
      const demoButton = await page.locator('#celebrate-button').boundingBox();
      assert.ok(demoButton.y + demoButton.height <= height, `Demo button must be above the fold at ${width}px`);
      assert.match(await page.locator('.demo-disclosure').textContent(), /Mac server required/);
      for (const control of await page.locator('.light-picker label, .demo-actions button').all()) {
        const bounds = await control.boundingBox();
        assert.ok(bounds.width >= 44 && bounds.height >= 44, `Room tap targets must be 44px at ${width}px`);
      }
    } finally {
      await page.close();
    }
  }
});

test('all board and art selectors update screenshots, copy, and full-screen links', async () => {
  const page = await newPage();
  try {
    await page.goto(base);
    for (const [key, file] of [['action', 'live-board'], ['multiview', 'multiview'], ['art', 'art-terrace'], ['ticker', 'command-ticker']]) {
      await page.locator(`[data-view="${key}"]`).click();
      assert.equal(await page.locator('[data-view][aria-pressed="true"]').count(), 1);
      assert.ok((await page.locator('#board-image').getAttribute('src')).endsWith(`${file}.jpg`));
      assert.ok((await page.locator('#board-expand').getAttribute('href')).endsWith(`${file}.jpg`));
      await page.locator('#board-image').evaluate((image) => image.decode());
    }
    const scenes = ['terrace', 'nocturne', 'ukiyoe', 'italian', 'neon', 'botanical'];
    for (const [index, key] of scenes.entries()) {
      await page.locator(`[data-art="${key}"]`).click();
      assert.equal(await page.locator('[data-art][aria-pressed="true"]').count(), 1);
      assert.ok((await page.locator('#art-image').getAttribute('src')).endsWith(`art-${key}.jpg`));
      assert.ok((await page.locator('#art-expand').getAttribute('href')).endsWith(`art-${key}.jpg`));
      assert.equal(await page.locator('#art-count').textContent(), `0${index + 1} / 06`);
      assert.equal(await page.locator('#art-expand .expand-label').textContent(), 'ENLARGE ↗');
      await page.locator('#art-image').evaluate((image) => image.decode());
    }
    await page.locator('#art-expand').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#lightbox').evaluate((dialog) => dialog.open), true);
    assert.match(await page.locator('#lightbox-image').getAttribute('src'), /art-botanical.jpg$/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#lightbox').evaluate((dialog) => dialog.open), false);
    assert.equal(await page.locator('#art-expand').evaluate((link) => link === document.activeElement), true);
    await page.locator('#board-expand').click();
    await page.getByRole('button', { name: 'Close full-screen image' }).click();
    assert.equal(await page.locator('#lightbox').evaluate((dialog) => dialog.open), false);
    await page.locator('.college-preview').click();
    assert.match(await page.locator('#lightbox-image').getAttribute('src'), /college-board.jpg$/);
    assert.match(await page.locator('#lightbox-caption').textContent(), /Georgia 38, Vanderbilt 14/);
    await page.keyboard.press('Escape');
  } finally {
    await page.close();
  }
});

test('link previews use the stacked-board card without requiring JavaScript', async () => {
  const page = await newPage({ javaScriptEnabled: false });
  try {
    await page.goto(base);
    const imageUrl = await page.locator('meta[property="og:image"]').getAttribute('content');
    assert.equal(imageUrl, 'https://stadiate.com/assets/stadiate-stacked-boards-v1.jpg');
    assert.equal(await page.locator('meta[name="twitter:image"]').getAttribute('content'), imageUrl);
    assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute('content'), 'summary_large_image');
    assert.match(await page.locator('meta[property="og:image:alt"]').getAttribute('content'), /stacked.*Art View/);
    assert.equal(
      await page.locator('meta[name="twitter:image:alt"]').getAttribute('content'),
      await page.locator('meta[property="og:image:alt"]').getAttribute('content'),
    );
    const localImageUrl = new URL(new URL(imageUrl).pathname, base).href;
    const response = await page.request.get(localImageUrl);
    assert.equal(response.status(), 200);
    assert.equal(response.headers()['content-type'], 'image/jpeg');
    const dimensions = await page.evaluate(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, localImageUrl);
    assert.deepEqual(dimensions, [1200, 630]);
    assert.equal(await page.locator('meta[property="og:image:width"]').getAttribute('content'), '1200');
    assert.equal(await page.locator('meta[property="og:image:height"]').getAttribute('content'), '630');
    assert.ok((await response.body()).length < 500_000, 'Keep the share image under 500 KB');
  } finally {
    await page.close();
  }
});

test('room demo is local-only, repeatable, and resets; FAQ uses native disclosure', async () => {
  const page = await newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(base);
    await page.clock.install();
    const requests = [];
    const sockets = [];
    page.on('request', (request) => requests.push(request.url()));
    page.on('websocket', (socket) => sockets.push(socket.url()));
    await page.locator('#celebrate-button').click();
    assert.equal(await page.locator('#room-demo').evaluate((element) => element.classList.contains('celebrating')), true);
    assert.match(await page.locator('#demo-status').textContent(), /No devices triggered/);
    await page.clock.fastForward(3000);
    await page.locator('#celebrate-button').click();
    await page.clock.fastForward(3000);
    assert.equal(await page.locator('#room-demo').evaluate((element) => element.classList.contains('celebrating')), true);
    await page.clock.fastForward(2600);
    assert.equal(await page.locator('#room-demo').evaluate((element) => element.classList.contains('celebrating')), false);
    assert.deepEqual(requests, [], 'The room demo must not request any network resources');
    assert.deepEqual(sockets, []);
    const question = page.locator('details').filter({ hasText: 'Does Stadiate stream the actual game?' });
    await question.locator('summary').click();
    assert.equal(await question.evaluate((element) => element.open), true);
    assert.match(await question.locator('p').textContent(), /does not include broadcast rights/);
  } finally {
    await page.close();
  }
});

test('all eight lighting combinations affect only the selected fixture zones', async () => {
  const page = await newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(base);
    await page.clock.install();
    const providers = ['hue', 'govee', 'ha'];
    for (let combination = 0; combination < 8; combination += 1) {
      for (const [index, provider] of providers.entries()) {
        const enabled = Boolean(combination & (1 << index));
        await page.locator(`[data-provider="${provider}"]`).setChecked(enabled);
      }
      await page.locator('#celebrate-button').click();
      assert.equal(await page.locator('#room-demo').getAttribute('data-phase'), 'lights');
      for (const [index, provider] of providers.entries()) {
        const enabled = Boolean(combination & (1 << index));
        assert.equal(await page.locator('#room-demo').getAttribute(`data-${provider}`), enabled ? 'on' : 'off');
        const opacity = await page.locator(`.${provider}-zone .light-bloom`).first()
          .evaluate((element) => Number(getComputedStyle(element).opacity));
        assert.equal(opacity, enabled ? .85 : 0, `${provider} combination ${combination}`);
      }
      if (combination === 0) assert.match(await page.locator('#demo-status').textContent(), /screen only/);
      await page.locator('#stop-celebration').click();
      assert.equal(await page.locator('#room-demo').getAttribute('data-phase'), 'idle');
      assert.equal(await page.locator('#stop-celebration').isDisabled(), true);
      await page.clock.fastForward(5000);
      assert.equal(await page.locator('#room-demo').getAttribute('data-phase'), 'idle', 'Stop cancels pending phases');
    }
    await page.locator('[data-provider="hue"]').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('[data-provider="hue"]').isChecked(), false);
    assert.equal(await page.locator('#room-demo').getAttribute('data-hue'), 'off');
    await page.locator('#celebrate-button').click();
    await page.locator('[data-provider="hue"]').check();
    assert.match(await page.locator('#demo-status').textContent(), /Hue/);
    assert.equal(await page.locator('.hue-zone .light-bloom').evaluate((element) => getComputedStyle(element).opacity), '0.85');
  } finally {
    await page.close();
  }
});

test('entrance runs once, sequences the reaction, and stops when scrolled away', async () => {
  const page = await newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  try {
    await page.clock.install();
    await page.goto(base);
    await page.waitForFunction(() => document.querySelector('#room-demo').dataset.phase === 'score');
    await page.clock.fastForward(500);
    assert.equal(await page.locator('#room-demo').getAttribute('data-phase'), 'lights');
    assert.equal(await page.locator('.strip-flow').evaluate((element) => getComputedStyle(element).animationName), 'strip-sweep');
    assert.equal(await page.locator('.strip-flow').evaluate((element) => getComputedStyle(element).animationIterationCount), '2');
    await page.clock.fastForward(3150);
    assert.equal(await page.locator('#room-demo').getAttribute('data-phase'), 'settle');
    await page.clock.fastForward(1300);
    assert.equal(await page.locator('#room-demo').getAttribute('data-phase'), 'idle');
    await page.clock.fastForward(10_000);
    assert.equal(await page.locator('#room-demo').getAttribute('data-phase'), 'idle', 'Entrance does not loop');
    await page.locator('#celebrate-button').click();
    await page.locator('#setup').evaluate((element) => element.scrollIntoView({ behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('#room-demo').dataset.phase === 'idle');
    await page.locator('#room-demo').evaluate((element) => element.scrollIntoView({ behavior: 'instant' }));
    await page.clock.fastForward(2000);
    assert.equal(await page.locator('#room-demo').getAttribute('data-phase'), 'idle', 'Returning does not restart the effect');
    await page.locator('#celebrate-button').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('#room-demo').dataset.phase === 'idle');
  } finally {
    await page.close();
  }
});

test('reduced motion skips autoplay and animations; hiding the page stops manual previews', async () => {
  const page = await newPage({ reducedMotion: 'reduce' });
  try {
    await page.clock.install();
    await page.goto(base);
    await page.clock.fastForward(6000);
    assert.equal(await page.locator('#room-demo').getAttribute('data-phase'), 'idle');
    await page.locator('#celebrate-button').click();
    assert.equal(await page.locator('#room-demo').getAttribute('data-phase'), 'lights');
    assert.deepEqual(await page.locator('.strip-flow').evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.animationName, style.transitionDuration];
    }), ['none', '0s']);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.locator('#room-demo').getAttribute('data-phase'), 'idle');
    await page.clock.fastForward(6000);
    assert.equal(await page.locator('#room-demo').getAttribute('data-phase'), 'idle');
  } finally {
    await page.close();
  }
});

test('capture provenance identifies real finals and matches every full-size screenshot', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/shots/capture.json', import.meta.url), 'utf8'));
  assert.equal(manifest.sources.length, 7);
  assert.equal(manifest.displayTimezone, 'America/New_York');
  const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: manifest.displayTimezone });
  for (const source of manifest.sources) {
    assert.equal(source.state, 'post');
    assert.match(source.url, /^https:\/\/site\.api\.espn\.com\/apis\/site\/v2\/sports\//);
    assert.ok(['2026-10-03', '2026-10-04'].includes(localDate.format(new Date(source.date))));
  }
  const nfl = manifest.sources.find((source) => source.game === 'nfl:401872971');
  assert.deepEqual(Object.fromEntries(nfl.teams.map((team) => [team.abbrev, team.score])), { BUF: '26', NE: '29' });
  const college = manifest.sources.find((source) => source.game === 'ncaaf:401856705');
  assert.deepEqual(Object.fromEntries(college.teams.map((team) => [team.abbrev, team.score])), { UGA: '38', VAN: '14' });
  for (const capture of manifest.captures) {
    const bytes = await readFile(new URL(`../assets/shots/${capture.file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), capture.sha256, capture.file);
    assert.ok(capture.games.every((game) => manifest.sources.some((source) => source.game === game)));
  }
});

test('historical normalization preserves source values and rejects incomplete data', () => {
  const summary = {
    header: { id: 'example', competitions: [{
      date: '2026-10-04T17:00Z', status: { type: { state: 'post', description: 'Final' } },
      competitors: [
        { team: { id: 'a', abbreviation: 'A', displayName: 'Team A' }, score: '29', homeAway: 'away' },
        { team: { id: 'b', abbreviation: 'B', displayName: 'Team B' }, score: '26', homeAway: 'home' },
      ],
    }] },
    boxscore: { players: [{ team: { id: 'a' }, statistics: [{
      name: 'passing', keys: ['completions/passingAttempts', 'passingYards', 'passingTouchdowns'],
      labels: ['C/ATT', 'YDS', 'TD'],
      athletes: [{ athlete: { id: 'player', displayName: 'Source Player', jersey: '10' }, stats: ['22/37', '269', '3'] }],
    }] }] },
  };
  const game = scoreboardFromSummary(summary, 'nfl');
  assert.equal(game.state, 'post');
  assert.equal(game.clock, '');
  assert.deepEqual(game.teams.map((team) => team.score), ['29', '26']);
  assert.deepEqual(playersFromSummary(summary)[0].stats.map((stat) => stat.value), ['22/37', '269', '3']);
  summary.header.competitions[0].status.type.state = 'in';
  assert.throws(() => scoreboardFromSummary(summary, 'nfl'), /verified final/);
  summary.boxscore.players[0].statistics[0].athletes[0].stats.pop();
  assert.throws(() => playersFromSummary(summary), /Missing historical player stat/);
});

test('content and privacy remain accessible without JavaScript', async () => {
  const page = await newPage({ javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  try {
    await page.goto(base);
    assert.equal(await page.locator('#comparison table').isVisible(), true);
    assert.equal(await page.locator('.no-script').first().isVisible(), true);
    assert.equal(await page.locator('.room-scene').isVisible(), true);
    assert.equal(await page.locator('.room-controls').isVisible(), false);
    assert.equal(await page.locator('#room-demo').getAttribute('data-phase'), 'idle');
    assert.match(await page.locator('.demo-disclosure').textContent(), /Silent; no devices connected/);
    await page.locator('a[href="privacy.html"]').last().click();
    assert.equal(await page.locator('h1').textContent(), 'Privacy Policy');
    assert.equal((await page.request.get(`${base}/privacy`)).status(), 200);
    assert.equal((await page.request.get(`${base}/.git/config`)).status(), 404);
  } finally {
    await page.close();
  }
});

test('every HTML page loads the cookieless analytics beacon exactly once', async () => {
  for (const [file, path] of [['index.html', '/'], ['privacy.html', '/privacy']]) {
    const html = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.equal(html.split(beaconSnippet).length - 1, 1, file);
    assert.equal(html.split('cloudflareinsights').length - 1, 1, file);
    assert.ok(html.indexOf(beaconSnippet) < html.indexOf('</body>'), file);
    const page = await newPage();
    try {
      await page.goto(base + path);
      assert.equal(await page.locator('script[src="https://static.cloudflareinsights.com/beacon.min.js"]').count(), 1);
      assert.deepEqual(await page.context().cookies(), [], file);
    } finally {
      await page.close();
    }
  }
  const privacy = await readFile(new URL('../privacy.html', import.meta.url), 'utf8');
  assert.match(privacy, /Cloudflare Web Analytics/);
  assert.match(privacy, /https:\/\/www\.cloudflare\.com\/privacypolicy\//);
  assert.match(privacy, /tv\.stadiate\.com/);
});
