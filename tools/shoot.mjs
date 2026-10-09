// Capture the current product renderer with verified historical game data.
// No board registration, hub writes, real-room effects, or private state access.
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadCaptureGames } from './capture-data.mjs';

const BASE = process.env.BASE || 'http://localhost:8787';
const OUT = new URL('../assets/shots/', import.meta.url);
const { games, sources } = await loadCaptureGames(BASE);
const captures = [];

const layouts = [
  ['live-board', { type: 'action', game: games[0].game }, '#action-main .field-wrap'],
  ['college-board', { type: 'action', game: games[4].game }, '#action-main .field-wrap'],
  ['multiview', { type: 'multiview', mosaic: 'grid-2x2', leagues: ['nfl'] }, '#multiview-main'],
  ['command-ticker', { type: 'ticker-wide', leagues: ['nfl'] }, '#wide-ticker-main .wt-card'],
  ...['terrace', 'nocturne', 'ukiyoe', 'italian', 'neon', 'botanical'].map((style) =>
    [`art-${style}`, { type: 'art', artStyle: style, leagues: ['nfl', 'ncaaf', 'mlb'] }, '#art-main .art-bg']),
];

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
try {
  await mkdir(OUT, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
    reducedMotion: 'reduce', timezoneId: 'America/New_York',
  });
  // Do not connect a screenshot browser to the hub's board-control channel.
  await context.routeWebSocket('**/*', (socket) => socket.close());
  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET') {
      throw new Error(`Capture attempted a hub write: ${route.request().method()} ${url.pathname}`);
    }
    let body;
    if (url.pathname.startsWith('/api/league-scoreboard/')) {
      const league = url.pathname.split('/').at(-1);
      body = { league, games: games.filter((game) => game.league === league) };
    }
    else if (/^\/api\/(game-action|gamecast|scoreboard)\//.test(url.pathname)) {
      const game = decodeURIComponent(url.pathname.split('/').at(-1));
      body = games.find((item) => item.game === game);
      if (!body) throw new Error(`No verified historical data for ${game}`);
    }
    else if (url.pathname === '/api/live-games') body = games;
    else if (url.pathname === '/api/ticker') body = { items: [] };
    else if (url.pathname === '/api/news') body = { items: [] };
    else {
      console.error(`Blocked unrelated capture request: ${url.pathname}`);
      await route.abort('blockedbyclient');
      return;
    }
    await route.fulfill({ json: body });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${BASE}/board?view=action&game=${games[0].game}&mode=primary&clock=off`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.ArtMode?.mount === 'function');
  await page.evaluate((rows) => {
    for (const row of rows) {
      state.scoreboards.set(row.game, row);
      state.actionGames.set(row.game, row);
    }
    for (const league of ['nfl', 'ncaaf', 'mlb']) {
      state.leagueScoreboards.set(league, rows.filter((row) => row.league === league));
    }
  }, games);

  for (const [name, main, selector] of layouts) {
    await page.evaluate((main) => {
      currentLayout = { template: 'custom', zones: { main, pip: { type: 'none' }, ticker: { enabled: false } } };
      applyLayout();
    }, main);
    await page.locator(selector).first().waitFor({ state: 'visible' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].filter((img) => img.src).map((img) => img.decode().catch(() => {
        if (img.getBoundingClientRect().width > 0) throw new Error(`Product image failed: ${img.src}`);
      })));
      const bg = document.querySelector('#art-main .art-bg');
      if (bg) {
        const url = getComputedStyle(bg).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
        if (url) {
          const image = new Image();
          image.src = url;
          await image.decode();
        }
      }
    });
    await page.waitForTimeout(1500);
    if (errors.length) throw new Error(errors.join('\n'));
    if (main.type === 'action') {
      await page.waitForFunction(() => document.querySelector('.stadium-log-header')?.textContent.includes('FINAL'));
      if (await page.locator('.stadium-player-caption').count()) throw new Error('Player spotlight data missing from Action View');
    }
    const screenshot = await page.screenshot({ path: new URL(`${name}.jpg`, OUT).pathname, type: 'jpeg', quality: 90 });
    captures.push({
      file: `${name}.jpg`,
      sha256: createHash('sha256').update(screenshot).digest('hex'),
      games: main.game ? [main.game] : games.filter((game) => main.leagues.includes(game.league)).map((game) => game.game),
    });
    if (name.startsWith('art-')) {
      const thumbnail = await page.evaluate(async (base64) => {
        const image = new Image();
        image.src = `data:image/jpeg;base64,${base64}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = 270;
        canvas.getContext('2d').drawImage(image, 0, 0, 480, 270);
        return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      }, screenshot.toString('base64'));
      await writeFile(new URL(`${name}-thumb.jpg`, OUT), Buffer.from(thumbnail, 'base64'));
    }
    console.log(`Captured ${name}.jpg`);
  }
  await writeFile(new URL('capture.json', OUT), JSON.stringify({
    capturedAt: new Date().toISOString(),
    displayTimezone: 'America/New_York',
    renderer: 'Current Stadiate web board; Art View shares its theme specification with tvOS.',
    data: 'Real October 3–4, 2026 final scores and box-score statistics, rendered at capture time. These are not screenshots recorded during live games. No hub settings or real boards were modified.',
    sources: sources.map(({ game, url }) => ({
      game: game.game, date: game.date, state: game.state, url,
      teams: game.teams.map(({ abbrev, score, homeAway }) => ({ abbrev, score, homeAway })),
      players: game.spotlightPlayers ?? [],
    })),
    captures,
    files: layouts.flatMap(([name]) => name.startsWith('art-') ? [`${name}.jpg`, `${name}-thumb.jpg`] : [`${name}.jpg`]),
  }, null, 2) + '\n');
} finally {
  await browser.close();
}
