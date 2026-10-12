// Capture the Action View as it stood at one verified scoring play.
// Same safety rules as tools/shoot.mjs: passive view mode, GET-only, no board
// registration, no hub writes, no real-room effects.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gameAtScoringPlay } from './capture-data.mjs';

const BASE = process.env.BASE || 'http://localhost:8787';
const OUT = new URL('../assets/shots/', import.meta.url);

const EVENT = '401872979';
const PLAY = '401872979110';
const LEAGUE = 'nfl';
const NAME = 'drive-board';
const SOURCE = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${EVENT}`;

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`Capture source failed: ${response.status} ${SOURCE}`);
const summary = await response.json();
if (String(summary.header?.id) !== EVENT) throw new Error(`Unexpected event returned by ${SOURCE}`);

const game = gameAtScoringPlay(summary, LEAGUE, PLAY);
const games = [game];
console.log(`State at ${game.capturedPlay.clock} Q${game.capturedPlay.period}: `
  + game.teams.map((t) => `${t.abbrev} ${t.score}`).join(' – '));

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
try {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
    reducedMotion: 'reduce', timezoneId: 'America/New_York',
  });
  await context.routeWebSocket('**/*', (socket) => socket.close());
  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET') {
      throw new Error(`Capture attempted a hub write: ${route.request().method()} ${url.pathname}`);
    }
    let body;
    if (url.pathname.startsWith('/api/league-scoreboard/')) {
      const league = url.pathname.split('/').at(-1);
      body = { league, games: games.filter((row) => row.league === league) };
    }
    else if (/^\/api\/(game-action|gamecast|scoreboard)\//.test(url.pathname)) {
      const id = decodeURIComponent(url.pathname.split('/').at(-1));
      body = games.find((row) => row.game === id);
      if (!body) throw new Error(`No verified historical data for ${id}`);
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
  await page.goto(`${BASE}/board?view=action&game=${game.game}&mode=primary&clock=off`, { waitUntil: 'load' });
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
  await page.evaluate((main) => {
    currentLayout = { template: 'custom', zones: { main, pip: { type: 'none' }, ticker: { enabled: false } } };
    applyLayout();
  }, { type: 'action', game: game.game });

  await page.locator('#action-main .field-wrap').first().waitFor({ state: 'visible' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter((img) => img.src).map((img) => img.decode().catch(() => {
      if (img.getBoundingClientRect().width > 0) throw new Error(`Product image failed: ${img.src}`);
    })));
  });
  await page.waitForTimeout(1500);
  if (errors.length) throw new Error(errors.join('\n'));

  // The board must show the moment, not the final.
  const header = await page.locator('.stadium-log-header').first().textContent();
  if (/FINAL/i.test(header ?? '')) throw new Error('Board rendered the final score instead of the captured moment');
  const shown = await page.locator('#action-main').first().textContent();
  if (!shown.includes(game.capturedPlay.clock)) {
    throw new Error(`Board does not show the captured clock ${game.capturedPlay.clock}`);
  }

  const screenshot = await page.screenshot({
    path: new URL(`${NAME}.jpg`, OUT).pathname, type: 'jpeg', quality: 90,
  });
  await writeFile(new URL('drive-capture.json', OUT), JSON.stringify({
    capturedAt: new Date().toISOString(),
    displayTimezone: 'America/New_York',
    renderer: 'Current Stadiate web board, Action View.',
    data: 'The Atlanta–New Orleans game of October 5, 2026 as it stood at one verified scoring play, rebuilt from the public ESPN summary for that completed game. Not a recording of a live broadcast. No hub settings or real boards were modified.',
    source: {
      game: game.game, url: SOURCE, date: game.date,
      play: game.capturedPlay,
      teams: game.teams.map(({ abbrev, score, homeAway }) => ({ abbrev, score, homeAway })),
    },
    drive: [...game.plays].reverse().map((p) => ({
      clock: p.clock, down: p.shortDownDistanceText, team: teamAbbrev(game, p), text: p.text,
      scoring: p.scoring, awayScore: p.awayScore, homeScore: p.homeScore,
      // Where the ball finished, so the page can draw the drive on a field.
      endYardsToEndzone: p.endYardsToEndzone,
    })),
    captures: [{
      file: `${NAME}.jpg`,
      sha256: createHash('sha256').update(screenshot).digest('hex'),
      games: [game.game],
    }],
    files: [`${NAME}.jpg`],
  }, null, 2) + '\n');
  console.log(`Captured ${NAME}.jpg`);
} finally {
  await browser.close();
}

function teamAbbrev(game, play) {
  const match = game.teams.find((team) => team.id === String(play.possessionTeamId ?? play.teamId));
  if (!match) throw new Error(`Play ${play.id} has no identifiable team`);
  return match.abbrev;
}
