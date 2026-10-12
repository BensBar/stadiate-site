# stadiate-site

Marketing site for **Stadiate** — _any room can be your stadium._

Static site (no build step): `index.html` + `privacy.html` + `assets/`.
The homepage uses self-hosted CSS, JavaScript, fonts, and product captures.
No external embeds, runtime product API calls, or CDN dependencies. The only
third-party script is the cookieless [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/)
beacon, added just before `</body>` on every HTML page (DNS isn't proxied, so
Cloudflare can't inject it automatically). Add it to any new page, and keep the
"This website" section of `privacy.html` accurate. No cookies, ad/social pixels,
session replay, or fingerprinting.
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

## Deploy (GitHub Pages)

`stadiate.com` is served by GitHub Pages from `main` at the repository root, so
there is nothing to build or configure per deploy:

1. Push to `main`. Pages rebuilds and the change is usually live within a minute.
2. `CNAME` holds the custom domain and must stay at the repository root.
3. DNS for the apex points at the GitHub Pages addresses (`185.199.108–111.153`),
   and HTTPS is issued and enforced by GitHub.

Cloudflare still provides DNS and the Web Analytics beacon, but it does **not**
host or proxy the site — which is exactly why the beacon has to be written into
each page by hand (see above) rather than injected automatically.

Check deploy state with `gh api repos/BensBar/stadiate-site/pages`.

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

The link-preview card is derived from those captures rather than drawn by hand:

```bash
npm run og
```

`tools/make-og.mjs` verifies `live-board.jpg` against its recorded hash, then
downscales it to the 1200×675 card at `assets/og.jpg`. Re-run it whenever the
screenshots are regenerated, so a shared link always previews the real board.

The room demo's main TV needs one more capture, taken at a single verified
scoring play rather than at a final score:

```bash
BASE=http://localhost:8787 npm run screenshots:drive
```

`tools/shoot-drive.mjs` rebuilds the October 5, 2026 Atlanta–New Orleans game
as it stood at Bijan Robinson's 59-yard touchdown (Q1 13:34), captures the
Action View to `assets/shots/drive-board.jpg`, and records that play plus the
rest of the drive in its own `assets/shots/drive-capture.json`. It writes a
separate manifest on purpose, so regenerating it never churns the provenance of
the ten main screenshots. Mid-game captures leave `spotlightPlayers` empty:
ESPN only publishes end-of-game box scores, so showing player lines beside a
first-quarter clock would state something untrue.

The play text in that manifest is rendered into `index.html` verbatim and the
test suite asserts the two still match, so the drive on the page cannot drift
from the drive that was captured.

### The main TV can play a real clip

The demo's main TV plays a video if one is installed at
`assets/clips/falcons-saints-td.mp4`, with sound, firing the touchdown at the
`data-td-at` cue on `#play-drive`. Nothing is bundled: that folder is
git-ignored except for its README, because the NFL highlight of this play is
neither embeddable (YouTube returns error 153) nor ours to re-host. Only
install a file you have the right to publish, and update the fine print and the
broadcast-rights FAQ when you do. With no clip present — which is what the
published site does — the TV replays the play-by-play instead. See
`assets/clips/README.md`.


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

The room demo is a CSS/WebAudio illustration, labeled as such. It makes no
device-control requests and synthesizes its sounds in the browser. The main TV
keeps showing the game; the touchdown celebration plays on a separate framed art
screen on a side wall, so the broadcast is never "taken over". Galleries remain static image links without JavaScript;
with JavaScript they gain scene selection and a keyboard-accessible native dialog.
The Cinzel display font is self-hosted with its OFL license in `assets/fonts/`.
Stained-glass team crests live in `assets/glass/` and are indexed by
`assets/teams.js`; they are artistic interpretations, so confirm trademark
clearance for team marks before public launch.
