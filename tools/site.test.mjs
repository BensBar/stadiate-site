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
    const page = await newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
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
      assert.match(await page.locator('#how').textContent(), /plain English/i);
      assert.equal(await page.locator('#teams .tile').count() >= 32, true);
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

test('room demo is local-only, repeatable, and resets; FAQ uses native disclosure', async () => {
  const page = await newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(base);
    await page.clock.install();
    const mutations = [];
    page.on('request', (request) => { if (request.method() !== 'GET') mutations.push(request.url()); });
    const room = page.locator('#room-scene');
    const on = () => room.evaluate((element) => element.classList.contains('tko-on'));
    await page.locator('#celebrate-button').click();
    await page.clock.fastForward(600);
    assert.equal(await on(), true);
    assert.equal(await page.locator('.r-art #tko-img').count(), 1);
    assert.equal(await page.locator('.r-tv .tko').count(), 0);
    assert.match(await page.locator('#demo-status').textContent(), /second screen/);
    await page.clock.fastForward(8000);
    assert.equal(await on(), false);
    await page.locator('#celebrate-button').click();
    await page.clock.fastForward(600);
    assert.equal(await on(), true);
    await page.clock.fastForward(8000);
    assert.equal(await on(), false);
    assert.deepEqual(mutations, []);
    const question = page.locator('details').filter({ hasText: 'Does Stadiate stream the actual game?' });
    await question.locator('summary').click();
    assert.equal(await question.evaluate((element) => element.open), true);
    assert.match(await question.locator('p').textContent(), /does not include broadcast rights/);
  } finally {
    await page.close();
  }
});

test('link previews use a real game board, not stained-glass art', async () => {
  const page = await newPage({ javaScriptEnabled: false });
  try {
    await page.goto(base);
    const url = await page.locator('meta[property="og:image"]').getAttribute('content');
    assert.equal(await page.locator('meta[name="twitter:image"]').getAttribute('content'), url);
    assert.equal(await page.locator('meta[property="og:image:width"]').getAttribute('content'), '1200');
    assert.equal(await page.locator('meta[property="og:image:height"]').getAttribute('content'), '675');
    assert.ok(await page.locator('meta[property="og:image:alt"]').getAttribute('content'));
    const pathname = new URL(url).pathname;
    assert.doesNotMatch(pathname, /\/glass\//, 'the share card must not be stained-glass art');
    const response = await page.request.get(base + pathname);
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'], /image\/jpeg/);
  } finally {
    await page.close();
  }
});

test('the page opens on a real game capture, with sports sections ahead of art', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/shots/capture.json', import.meta.url), 'utf8'));
  const page = await newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    await page.goto(base);
    const source = new URL(await page.locator('.hero img').first().getAttribute('src'), base).pathname;
    assert.ok(manifest.captures.some((capture) => source === `/assets/shots/${capture.file}`),
      `Hero leads with ${source}, which is not a provenanced capture`);
    assert.ok(!source.startsWith('/assets/shots/art-'), `Hero leads with Art View (${source})`);
    assert.equal(await page.locator('.hero img[src*="/glass/"]').count(), 0);
    const order = await page.evaluate(() => [...document.querySelectorAll('main > section')].map((section) => section.id));
    for (const sports of ['how', 'room', 'boards']) {
      assert.ok(order.indexOf(sports) > -1 && order.indexOf(sports) < order.indexOf('art'),
        `#${sports} must come before #art`);
    }
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

test('the drive shown on the page is the drive that was captured', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/shots/drive-capture.json', import.meta.url), 'utf8'));
  const page = await newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(base);
    const host = new URL(base).host;
    const offsite = [];
    page.on('request', (request) => {
      const requested = new URL(request.url()).host;
      if (requested !== host && !requested.endsWith('cloudflareinsights.com')) offsite.push(request.url());
    });

    // The play-by-play on the page must be the captured feed, verbatim.
    const onPage = await page.locator('#drive-list li').evaluateAll((items) => items.map((item) => ({
      clock: item.dataset.clock,
      team: item.dataset.team,
      scoring: item.dataset.scoring === 'true',
      text: item.querySelector('.dl-text').textContent,
    })));
    assert.deepEqual(onPage, manifest.drive.map(({ clock, team, scoring, text }) =>
      ({ clock, team, scoring: Boolean(scoring), text })));
    assert.equal(onPage.at(-1).scoring, true, 'the drive must end on the scoring play');
    assert.match(await page.locator('#art-pic').getAttribute('src'), /drive-board\.jpg$/);

    assert.equal(Number(await page.locator('#play-drive').getAttribute('data-td-at')), 14);
    // No video ships with the site, so the page must stand on its own.
    assert.equal(await page.locator('#tv-clip').getAttribute('src'), null);
    assert.equal(await page.locator('.r-tv .tko').count(), 0);
    assert.deepEqual(offsite, [], 'the demo must load nothing off-site');
  } finally {
    await page.close();
  }
});

test('an installed clip plays on the main TV, with sound, and scores on the cue', async () => {
  // Synthetic fixture, so the clip path is exercised without shipping any video.
  const fixture = await readFile(new URL('./fixtures/clip.webm', import.meta.url));
  const page = await newPage({ reducedMotion: 'reduce' });
  try {
    await page.route('**/assets/clips/*', (route) =>
      route.fulfill({ status: 200, contentType: 'video/webm', body: fixture }));
    await page.goto(base);
    const clip = page.locator('#tv-clip');
    // Nothing is fetched until someone asks for it.
    assert.equal(await clip.getAttribute('src'), null);
    assert.equal(await clip.isVisible(), false);

    const room = page.locator('#room-scene');
    const on = () => room.evaluate((element) => element.classList.contains('tko-on'));
    await page.locator('#play-drive').click();
    await page.waitForFunction(() => {
      const video = document.querySelector('#tv-clip');
      return !video.hidden && !video.paused && video.currentTime > 0;
    }, null, { timeout: 10000 });
    assert.equal(await clip.evaluate((video) => video.muted), false, 'the clip must play with sound');
    assert.equal(await page.locator('#tv-unmute').isVisible(), false);
    assert.equal(await on(), false, 'the room must stay quiet before the cue');
    // The play-by-play fallback must not run underneath the video.
    assert.equal(await page.locator('#tv-drive').isVisible(), false);

    const cue = Number(await page.locator('#play-drive').getAttribute('data-td-at'));
    // Run the clip fast rather than seeking: a stubbed response is not seekable.
    await clip.evaluate((video) => { video.playbackRate = 16; });
    await page.waitForFunction((at) => {
      const video = document.querySelector('#tv-clip');
      return video.currentTime >= at && document.querySelector('#room-scene').classList.contains('tko-on');
    }, cue, { timeout: 20000 });
    assert.equal(await page.locator('#drive-list li.now').getAttribute('data-scoring'), 'true');
  } finally {
    await page.close();
  }
});

test('the main TV falls back to the play-by-play when a clip fails to load', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/shots/drive-capture.json', import.meta.url), 'utf8'));
  const page = await newPage({ reducedMotion: 'reduce' });
  try {
    await page.route('**/assets/clips/*', (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto(base);

    // The ball is drawn from the captured yard lines, not from any footage.
    const yards = await page.locator('#drive-list li').evaluateAll((items) =>
      items.map((item) => Number(item.dataset.yd)));
    assert.deepEqual(yards, manifest.drive.map((play) => 100 - play.endYardsToEndzone));
    assert.equal(yards.at(-1), 100, 'the scoring play must finish in the end zone');

    await page.locator('#play-drive').click();
    await page.waitForFunction(() => !document.querySelector('#tv-drive').hidden, null, { timeout: 10000 });
    assert.equal(await page.locator('#tv-clip').isVisible(), false);
    assert.equal(await page.locator('#tv-ball').isVisible(), true);

    await page.waitForFunction(() => document.querySelector('#room-scene').classList.contains('tko-on'),
      null, { timeout: 20000 });
    assert.equal(await page.locator('#drive-list li.now').getAttribute('data-scoring'), 'true');
    // 8% + 100 yards * 0.84 is the goal line the drive is attacking.
    assert.equal(await page.locator('#tv-ball').evaluate((element) => element.style.left), '92%');
  } finally {
    await page.close();
  }
});
