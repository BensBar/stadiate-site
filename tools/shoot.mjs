// Playwright capture of Stadiate product surfaces for the marketing site.
// Runs against the live local hub (http://localhost:8787). No auth needed
// (hub has no PIN set). Registers a throwaway preview board, pushes layouts,
// and screenshots the board + phone remote into ../assets/shots/.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8787';
const OUT = new URL('../assets/shots/', import.meta.url);
const BOARD_ID = 'site-preview';
const GAME = 'mlb:401815968'; // ATL vs STL (Braves)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (path, opts = {}) =>
  fetch(BASE + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
const p = (name) => new URL(name, OUT).pathname;

const stacked = {
  template: 'stacked-scoreboard',
  zones: { main: { type: 'stacked', game: GAME }, pip: { type: 'none' }, ticker: { enabled: true, sources: ['scores:mlb'] } },
};
const multiview = {
  template: 'scoreboards-multiview',
  zones: { main: { type: 'multiview' }, pip: { type: 'none' }, ticker: { enabled: true, sources: ['scores:mlb'] } },
};

async function main() {
  const tokRes = await api('/api/boards/setup-token', { method: 'POST' });
  if (!tokRes.ok) throw new Error(`setup-token ${tokRes.status}: ${await tokRes.text()}`);
  const { token } = await tokRes.json();

  const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });

  // ---- Board shots (landscape) ----
  const boardCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await boardCtx.addInitScript((id) => {
    try { localStorage.setItem('boardId', id); localStorage.removeItem('boardToken'); } catch {}
  }, BOARD_ID);
  const board = await boardCtx.newPage();
  await board.goto(`${BASE}/board?setup=${token}`, { waitUntil: 'networkidle' }).catch(() => {});
  await sleep(4000);

  await board.screenshot({ path: p('board-idle.png') });
  console.log('shot board-idle.png');

  let r = await api(`/api/boards/${BOARD_ID}/layout`, { method: 'POST', body: JSON.stringify(stacked) });
  console.log('push stacked:', r.status);
  await sleep(7000);
  await board.screenshot({ path: p('board.png') });
  console.log('shot board.png');

  r = await api(`/api/boards/${BOARD_ID}/layout`, { method: 'POST', body: JSON.stringify(multiview) });
  console.log('push multiview:', r.status);
  await sleep(7000);
  await board.screenshot({ path: p('board-multiview.png') });
  console.log('shot board-multiview.png');
  await boardCtx.close();

  // ---- Phone remote (portrait, retina) ----
  const phoneCtx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true });
  const phone = await phoneCtx.newPage();
  await phone.goto(`${BASE}/`, { waitUntil: 'networkidle' }).catch(() => {});
  await sleep(3500);
  await phone.screenshot({ path: p('remote.png') });
  console.log('shot remote.png');
  await phoneCtx.close();

  await api(`/api/boards/${encodeURIComponent(BOARD_ID)}`, { method: 'DELETE' }).catch(() => {});
  await browser.close();
}
main().catch((e) => { console.error('shoot failed:', e.message); process.exit(1); });
