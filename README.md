# stadiate-site

Marketing site for **Stadiate** — _any room can be your stadium._

Static site (no build step): `index.html` + `privacy.html` + `assets/`.
The homepage uses self-hosted CSS, JavaScript, fonts, and product captures.
No analytics, external embeds, runtime product API calls, or CDN dependencies.
The `/privacy` page satisfies the App Store privacy-policy requirement.

## Local development

```bash
npm ci
npm run dev
# http://127.0.0.1:4173
npm test
```

Tests use the existing Playwright dependency with an ephemeral local server.
If Chromium isn't installed, run `npx playwright install chromium`.
They cover 320–1440px layouts, image loading, anchor targets, all gallery
choices, keyboard/lightbox behavior, the local-only celebration preview,
FAQ disclosure, and the no-JavaScript/privacy path.

## Deploy (Cloudflare Pages)

DNS for `stadiate.com` is already on Cloudflare, so:

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick this repo.
3. Build settings: **Framework preset: None**, **Build command: (empty)**, **Output directory: `/`**.
4. After the first deploy → **Custom domains** → add `stadiate.com` and `www.stadiate.com`.

Automatic HTTPS is included; every push to `main` redeploys.

## Product screenshots

The October 2026 `.jpg` images in `assets/shots/` are fresh captures of the
current Stadiate **web board renderer**, not native tvOS screenshots or
recreated marketing UI. They render **real October 3–4 final results** today;
they were not recorded during live games. `capture.json` records source URLs,
event IDs, scores, player statistics, capture time, and screenshot SHA-256 hashes.
Art View shares its theme specification with the native Apple TV renderer;
native layouts can differ. The site discloses this beside the gallery.

Capture with a current Stadiate hub reachable at `BASE`:

```bash
BASE=http://localhost:8787 npm run screenshots
```

`tools/capture-data.mjs` obtains historical results and individual player stats
from public ESPN event summaries, and historical play-by-play from the hub's
public gamecast endpoint. It checks event IDs, final status, and agreement
between the final score and the last play. Missing or inconsistent data fails
the capture; scores, names, clocks, and statistics are never invented.
The featured games are New England–Buffalo (29–26, October 4) and
Vanderbilt–Georgia (14–38, October 3).

The capture tool loads the actual product UI in passive view mode, supplies
these historical payloads only inside the capture browser, and blocks the
board WebSocket. It never
registers a board, modifies a layout on the hub, reads private configuration,
or triggers real-room effects. Unrelated API requests are explicitly blocked
and logged. All image and renderer errors fail the capture.

## Product claims and release status

The comparison was checked against `BensBar/stadiate`'s tvOS documentation,
the current `feat/art-mode-broadcast` native views and shared theme catalog
(commit `65791dd4ea10f3a0b6d0371c4fe6eb70c497ed8d`), and the Mac menu-bar
app documentation on `main`.

- Apple TV is standalone-first: scores, multiview, Arena, ticker, Art View,
  native celebrations, anti-spoiler delay, and a paired phone remote.
  Polling/remote service require the app to be in the foreground.
- The optional Mac hub adds device integrations, rule-driven room effects,
  coordinated boards, spoken calls/ambience, webhooks, fantasy-player
  celebrations, and video capture.
  Capture needs a supported source, ffmpeg, and permissions; DRM still applies.
- Fantasy supports Sleeper, manual rosters, and experimental CBS. It celebrates
  player scoring events, not fantasy-point totals. Roster mappings, starters-only
  selection, per-game SYNC, and CBS limitations were checked against the product
  README and `docs/fantasy-cbs.md`. Do not imply CBS embedded sign-in is verified,
  or describe the safe preview as a real lights/sound event.
- "Frame TV art. For sports fans." describes using an Apple TV-connected
  display, not a native Samsung TV app.
- Stadiate is not a game-streaming subscription or an overlay on other tvOS apps.
- Preserve the coming-soon release status until public availability is verified.
  The Mac app currently has private builds, not a public signed download.
  Do not link visitors to the private product repository or invent store URLs.

The room demo is a silent CSS illustration, labeled as such. It makes no
device-control requests. Galleries remain static image links without JavaScript;
with JavaScript they gain scene selection and a keyboard-accessible native dialog.
The Bebas Neue display font is self-hosted with its OFL license in `assets/fonts/`.
