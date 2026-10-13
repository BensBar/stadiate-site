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
      assert.match(await page.locator('#how').textContent(), /Three steps/);
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
    await page.locator('#board-previews > summary').click();
    for (const [key, file] of [['action', 'live-board'], ['multiview', 'multiview'], ['art', 'art-terrace'], ['ticker', 'command-ticker']]) {
      await page.locator(`[data-view="${key}"]`).click();
      assert.equal(await page.locator('[data-view][aria-pressed="true"]').count(), 1);
      assert.ok((await page.locator('#board-image').getAttribute('src')).endsWith(`${file}.jpg`));
      assert.ok((await page.locator('#board-expand').getAttribute('href')).endsWith(`${file}.jpg`));
      await page.locator('#board-image').evaluate((image) => image.decode());
    }
    await page.locator('#art-previews > summary').click();
    const scenes = ['terrace', 'nocturne', 'italian', 'cathedral'];
    const titles = ['The Terrace', 'Let’s Van Gogh!', 'The Game-Day Journal', 'Cathedral of the Gridiron'];
    assert.deepEqual(await page.locator('[data-art]').evaluateAll((buttons) => buttons.map(button => button.dataset.art)), scenes);
    assert.match(await page.locator('#art .section-intro').textContent(), /12 more themes/);
    for (const [index, key] of scenes.entries()) {
      await page.locator(`[data-art="${key}"]`).click();
      assert.equal(await page.locator('[data-art][aria-pressed="true"]').count(), 1);
      assert.ok((await page.locator('#art-image').getAttribute('src')).endsWith(`art-${key}.jpg`));
      assert.ok((await page.locator('#art-expand').getAttribute('href')).endsWith(`art-${key}.jpg`));
      assert.equal(await page.locator('#art-count').textContent(), `0${index + 1} / 04`);
      assert.equal(await page.locator('#art-title').textContent(), titles[index]);
      await page.locator('#art-image').evaluate((image) => image.decode());
    }
    await page.locator('#art-expand').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#lightbox').evaluate((dialog) => dialog.open), true);
    assert.match(await page.locator('#lightbox-image').getAttribute('src'), /art-cathedral.jpg$/);
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

test('the compact page keeps detail optional and uses slow red and silver accents', async () => {
  // Before this simplification: 8,411px on mobile and 7,011px on desktop.
  for (const [width, maxHeight] of [[375, 4300], [1440, 3500]]) {
    const page = await newPage({ viewport: { width, height: 900 }, reducedMotion: 'no-preference' });
    try {
      await page.goto(base);
      await page.evaluate(() => document.fonts.ready);
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight) < maxHeight,
        `Keep the main reading path short at ${width}px`);
      assert.ok(await page.locator('main').evaluate((element) => element.innerText.trim().split(/\s+/).length) < 350,
        'The default page should explain the product in fewer than 350 words');
      assert.match(await page.locator('.platform-line').innerText(), /Apple TV app.*Mac-powered browser boards/);
      assert.match(await page.locator('.server-card').innerText(), /compatible web browser.*No Apple TV needed/s);
      for (const selector of ['.demo-details', '#board-previews', '#art-previews', '#teams details', '#comparison']) {
        const details = page.locator(selector);
        assert.equal(await details.evaluate((element) => element.open), false);
        await details.locator('summary').focus();
        await page.keyboard.press('Enter');
        assert.equal(await details.evaluate((element) => element.open), true);
      }
      assert.equal(await page.locator('#drive-list').isVisible(), true);
      assert.equal(await page.locator('#comparison table').isVisible(), true);
      assert.equal(await page.locator('#gallery .tile').first().isVisible(), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `Expanded details must not overflow at ${width}px`);
      const accents = await page.locator('.jewel, .hero-texture, .button-primary').evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element);
          return { background: style.backgroundImage, animation: style.animationName, duration: parseFloat(style.animationDuration) };
        }));
      for (const accent of accents) {
        for (const match of accent.background.matchAll(/rgba?\((\d+), (\d+), (\d+)/g)) {
          const [r, g, b] = match.slice(1).map(Number);
          assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 20 || (r > g && r > b),
            `Page accents must be red or neutral, not rainbow: ${match[0]}`);
        }
        if (accent.animation !== 'none') assert.ok(accent.duration >= 20, 'color changes must be slow');
      }
      assert.equal(await page.locator('.hero .jewel').evaluate((element) => getComputedStyle(element).animationName), 'alloy-shift');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await page.locator('.hero .jewel').evaluate((element) => getComputedStyle(element).animationName), 'none');
      assert.deepEqual(await page.locator('#how ol .step-number').allTextContents(), ['1', '2', '3']);
      assert.deepEqual(await page.locator('.view-choice .choice-number').allTextContents(), ['1', '2', '3', '4']);
    } finally {
      await page.close();
    }
  }
});

test('the collapsed team collection still filters leagues and previews team colors', async () => {
  const page = await newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(base);
    await page.locator('#teams summary').click();
    for (const [league, count] of [['nfl', 32], ['ncaaf', 36], ['sec', 16]]) {
      await page.locator(`[data-tab="${league}"]`).click();
      assert.equal(await page.locator('#gallery .tile').count(), count);
      assert.equal(await page.locator('.tabs [aria-pressed="true"]').getAttribute('data-tab'), league);
    }
    const name = (await page.locator('#gallery .tile').first().getAttribute('aria-label')).replace('Light the room for ', '');
    await page.locator('#gallery .tile').first().click();
    assert.equal(await page.locator('#team').inputValue(), name);
    assert.ok((await page.locator('#badge-txt').textContent()).includes(name));
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
    await page.locator('.demo-options summary').click();
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

test('the hero opens on the TV demo with unobstructed controls in the first phone viewport', async () => {
  for (const [width, height] of [[320, 568], [390, 664]]) {
    const page = await newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    try {
      await page.goto(base);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('.hero #tv-clip').count(), 1);
      assert.equal(await page.locator('.hero #hero-expand').count(), 0);
      assert.match(await page.locator('.hero #tv-poster').getAttribute('src'), /falcons-saints-poster.jpg$/);
      assert.equal(await page.locator('.r-tv button, .r-tv video[controls]').count(), 0);
      const roomBounds = await page.locator('#room-scene').boundingBox();
      assert.ok(roomBounds.y > 0 && roomBounds.y + roomBounds.height < height);
      for (const selector of ['#play-drive', '#snd']) {
        const bounds = await page.locator(selector).boundingBox();
        assert.ok(bounds.y >= roomBounds.y + roomBounds.height, `${selector} must be below the TV`);
        assert.ok(bounds.y + bounds.height < height, `${selector} must be visible without scrolling at ${width}px`);
      }
      const order = await page.evaluate(() => [...document.querySelectorAll('main > section')].map((section) => section.id));
      assert.ok(order.indexOf('top') < order.indexOf('how'));
      for (const sports of ['top', 'how', 'boards']) {
        assert.ok(order.indexOf(sports) > -1 && order.indexOf(sports) < order.indexOf('art'),
          `#${sports} must come before #art`);
      }
    } finally {
      await page.close();
    }
  }
});

test('capture provenance identifies real finals and matches every full-size screenshot', async () => {
  for (const file of ['capture.json', 'cathedral-capture.json']) {
    const manifest = JSON.parse(await readFile(new URL(`../assets/shots/${file}`, import.meta.url), 'utf8'));
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
  const page = await newPage({ javaScriptEnabled: false, reducedMotion: 'reduce', viewport: { width: 375, height: 812 } });
  try {
    await page.goto(base);
    assert.equal(await page.locator('#comparison table').isVisible(), false);
    await page.locator('#comparison summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#comparison table').isVisible(), true);
    await page.locator('.demo-details summary').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#drive-list').isVisible(), true);
    for (const id of ['board', 'art']) {
      await page.locator(`#${id}-previews > summary`).focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator(`#${id}-expand`).isVisible(), true);
    }
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

    assert.equal(Number(await page.locator('#play-drive').getAttribute('data-td-at')), 13);
    // Reduced motion leaves the real poster in place until a click.
    assert.equal(await page.locator('#tv-clip').getAttribute('src'), null);
    assert.equal(await page.locator('.r-tv .tko').count(), 0);
    assert.deepEqual(offsite, [], 'the demo must load nothing off-site');
  } finally {
    await page.close();
  }
});

test('the video autoplays muted, scores from media time, and replays with sound', async () => {
  const page = await newPage({ reducedMotion: 'no-preference' });
  try {
    const requests = [];
    page.on('request', (request) => {
      if (request.url().endsWith('.mp4')) requests.push(request.url());
    });
    await page.clock.install();
    await page.goto(base);
    const clip = page.locator('#tv-clip');
    assert.equal(await page.locator('.r-tv #tv-poster').count(), 1);
    await page.locator('#room-scene').scrollIntoViewIfNeeded();

    const room = page.locator('#room-scene');
    const on = () => room.evaluate((element) => element.classList.contains('tko-on'));
    await page.waitForFunction(() => {
      const video = document.querySelector('#tv-clip');
      return !video.hidden && !video.paused && video.currentTime > 0;
    }, null, { timeout: 10000 });
    assert.ok(requests.length > 0, 'the hero demo must autoplay on arrival');
    const firstFrame = await clip.screenshot();
    await page.waitForTimeout(300);
    assert.notDeepEqual(await clip.screenshot(), firstFrame, 'the main TV must actually play video');
    assert.equal(await on(), false, 'the room must stay quiet before the cue');
    assert.match(await page.locator('#play-drive').textContent(), /Replay with sound/);
    assert.equal(await page.locator('#snd').getAttribute('aria-pressed'), 'false', 'autoplay must start without sound');
    assert.equal(await page.locator('#team').isVisible(), false, 'extra choices stay out of the primary playback controls');
    assert.equal(await page.locator('#tv-drive').isVisible(), false);
    await clip.evaluate((video) => { video.currentTime = 12.8; });
    await page.waitForFunction(() => document.querySelector('#room-scene').classList.contains('tko-on'));
    assert.equal(await page.locator('#drive-list li.now').getAttribute('data-scoring'), 'true');

    await page.locator('#play-drive').click();
    await page.waitForFunction(() => {
      const video = document.querySelector('#tv-clip');
      return !video.hidden && !video.paused && video.currentTime < 3 && !video.muted;
    });
    assert.equal(await on(), false);
    await page.locator('#stop-drive').click();
    await page.clock.fastForward(15000);
    assert.equal(await clip.isVisible(), false);
    assert.equal(await page.locator('#tv-poster').isVisible(), true);
    assert.equal(await on(), false, 'stopping cancels the pending touchdown');

    await page.locator('#play-drive').click();
    await page.waitForFunction(() => !document.querySelector('#tv-clip').paused);
    await clip.evaluate((video) => { video.currentTime = video.duration - 0.2; });
    await page.waitForFunction(() => document.querySelector('#tv-clip').hidden);
    assert.equal(await clip.isVisible(), false, 'the finished video returns to a real still frame');
    assert.equal(await page.locator('#tv-poster').isVisible(), true);
  } finally {
    await page.close();
  }
});

test('the main TV falls back to the play-by-play when a clip fails to load', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/shots/drive-capture.json', import.meta.url), 'utf8'));
  const page = await newPage({ reducedMotion: 'no-preference' });
  try {
    await page.route('**/assets/clips/bijan-touchdown.mp4', (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto(base);

    // The ball is drawn from the captured yard lines, not from any footage.
    const yards = await page.locator('#drive-list li').evaluateAll((items) =>
      items.map((item) => Number(item.dataset.yd)));
    assert.deepEqual(yards, manifest.drive.map((play) => 100 - play.endYardsToEndzone));
    assert.equal(yards.at(-1), 100, 'the scoring play must finish in the end zone');

    await page.locator('#play-drive').click();
    await page.waitForFunction(() => !document.querySelector('#tv-drive').hidden, null, { timeout: 10000 });
    assert.match(await page.locator('#demo-status').textContent(), /play could not load|captured play-by-play/);
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

test('reduced motion waits for a tap and plays the original game audio', async () => {
  const page = await newPage({ reducedMotion: 'reduce' });
  try {
    const videos = [];
    page.on('request', (request) => { if (request.url().endsWith('.mp4')) videos.push(request.url()); });
    await page.goto(base);
    await page.locator('#room-scene').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#tv-clip').getAttribute('src'), null);
    assert.equal(await page.locator('#tv-poster').isVisible(), true);
    assert.deepEqual(videos, []);
    await page.locator('#play-drive').click();
    await page.waitForFunction(() => {
      const video = document.querySelector('#tv-clip');
      return !video.hidden && !video.paused && !video.muted && video.currentTime > 0
        && video.webkitAudioDecodedByteCount > 0;
    });
    assert.ok(videos.length > 0);
    assert.equal(await page.locator('#tv-drive').isVisible(), false);
  } finally {
    await page.close();
  }
});

test('pausing the video prevents a wall-clock touchdown and can resume below the TV', async () => {
  const page = await newPage({ reducedMotion: 'no-preference' });
  try {
    await page.clock.install();
    await page.goto(base);
    await page.locator('#room-scene').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !document.querySelector('#tv-clip').paused);
    await page.locator('#tv-clip').evaluate((video) => video.pause());
    await page.clock.fastForward(15000);
    assert.equal(await page.locator('#room-scene').evaluate((element) => element.classList.contains('tko-on')), false);
    await page.locator('#play-drive').click();
    await page.waitForFunction(() => !document.querySelector('#tv-clip').paused);
    assert.equal(await page.locator('#tv-clip').evaluate((video) => video.muted), false);
  } finally {
    await page.close();
  }
});

test('Safari video delivery supports MIME types, byte ranges, and seeking', async () => {
  const path = '/assets/clips/bijan-touchdown.mp4';
  const bytes = await readFile(new URL(`..${path}`, import.meta.url));
  const head = await fetch(base + path, { method: 'HEAD' });
  assert.equal(head.headers.get('content-type'), 'video/mp4');
  assert.equal(head.headers.get('content-length'), String(bytes.length));
  assert.equal(head.headers.get('accept-ranges'), 'bytes');
  for (const [range, start, end] of [['bytes=0-1', 0, 1], ['bytes=100-', 100, bytes.length - 1], ['bytes=-16', bytes.length - 16, bytes.length - 1]]) {
    const response = await fetch(base + path, { headers: { Range: range } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${bytes.length}`);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(start, end + 1));
  }
  for (const range of [`bytes=${bytes.length}-`, 'bytes=5-2', 'bytes=-0', 'bytes=bad']) {
    const response = await fetch(base + path, { headers: { Range: range } });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get('content-range'), `bytes */${bytes.length}`);
  }
});

test('blocked autoplay offers a direct tap instead of switching to the drawn feed', async () => {
  const page = await newPage();
  try {
    await page.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play;
      let first = true;
      HTMLMediaElement.prototype.play = function () {
        if (first) { first = false; return Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError')); }
        return play.call(this);
      };
    });
    await page.goto(base);
    await page.locator('#room-scene').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('#demo-status').textContent.includes('Tap Play'));
    assert.equal(await page.locator('#tv-drive').isVisible(), false);
    await page.locator('#play-drive').click();
    await page.waitForFunction(() => {
      const video = document.querySelector('#tv-clip');
      return !video.paused && !video.muted && video.currentTime > 0;
    });
  } finally {
    await page.close();
  }
});

test('the recorded Falcons horn and all video and audio end 4.5 seconds after the touchdown', async () => {
  const page = await newPage({ reducedMotion: 'reduce' });
  try {
    await page.addInitScript(() => {
      window.synthesizedNotes = 0;
      const createOscillator = AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator = function () {
        window.synthesizedNotes++;
        return createOscillator.call(this);
      };
    });
    await page.goto(base);
    await page.locator('#play-drive').click();
    await page.waitForFunction(() => document.querySelector('#tv-clip').currentTime > 0);
    await page.locator('#tv-clip').evaluate((video) => { video.currentTime = 12.8; });
    await page.waitForFunction(() => document.querySelector('#room-scene').classList.contains('tko-on'));
    const cue = Number(await page.locator('#play-drive').getAttribute('data-td-at'));
    const duration = await page.locator('#tv-clip').evaluate(video => video.duration);
    assert.ok(Math.abs(duration - cue - 4.5) < 0.05, `Clip must end 4.5s after touchdown, not at ${duration}s`);
    await page.waitForFunction(() => document.querySelector('#tv-clip').hidden, null, { timeout: 7000 });
    const video = await page.locator('#tv-clip').evaluate((element) => ({
      time: element.currentTime, paused: element.paused, muted: element.muted, audioBytes: element.webkitAudioDecodedByteCount,
    }));
    assert.ok(video.time > 17);
    assert.equal(video.paused, true);
    assert.equal(video.muted, false);
    assert.ok(video.audioBytes > 0);
    assert.equal(await page.evaluate(() => window.synthesizedNotes), 0, 'do not play an imitation over the recorded Falcons horn');
    assert.equal(await page.locator('#room-scene').evaluate(element => element.classList.contains('tko-on')), false);
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#tv-clip').evaluate(element => element.currentTime), video.time);
    await page.locator('#play-drive').click();
    await page.waitForFunction(() => {
      const video = document.querySelector('#tv-clip');
      return !video.hidden && !video.paused && video.currentTime > 0 && video.currentTime < 2;
    });
  } finally {
    await page.close();
  }
});
