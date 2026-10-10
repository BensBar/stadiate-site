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
all eight lighting combinations, finite autoplay, reduced motion, viewport/tab
cleanup, above-the-fold room controls, FAQ disclosure, and the
no-JavaScript/privacy path.

## Deploy (GitHub Pages)

GitHub Pages publishes the root directory of `main` to `https://stadiate.com/`.
The custom domain is recorded in `CNAME`; HTTPS is enforced.

1. Run `npm test`. If the board composition changed, regenerate the committed
   link-preview image with `npm run social-card`.
2. Push the feature branch and open a pull request targeting `main`.
3. Merge the PR, then confirm the GitHub Pages deployment completes and the
   changes appear on `https://stadiate.com/`.

There is no production build command. Local previews and feature-branch pushes
do not change the live site. The separate Cloudflare Workers build integration
is not the GitHub Pages deployment.

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

The opening room demo is an SVG mancave concept, not a photo or a model of an
actual user's room. Its screens use the verified historical captures; the
touchdown overlay is explicitly a demo event, not another score from those games.
Hue lamps, Govee LAN strips, and Home Assistant-connected downlights can be
included independently. These illustrated fixture choices do not limit the
product integrations to those types of lights. Actual effects require the Mac
server and compatible devices; color effects require color-capable lights.

The silent 4.8-second sequence runs once on arrival when the room is visible,
then only on request. It includes score, room reaction, and afterglow phases,
with replay and stop controls. Leaving the viewport, hiding the page, or enabling
reduced motion stops it. Reduced motion also prevents autoplay and replaces
manual animation with a static preview. No device-control requests are made.
Without JavaScript the room remains a labeled static illustration.
Galleries remain static image links without JavaScript;
with JavaScript they gain scene selection and a keyboard-accessible native dialog.
The Bebas Neue display font is self-hosted with its OFL license in `assets/fonts/`.

## Link preview image

Open Graph and Twitter cards use the same 1200 x 630 JPEG of the stacked
Action View, multiview, and Art View screens, not an individual game capture.
The image and metadata are static so messaging crawlers need no JavaScript.

Run `npm run social-card` after changing the hero or its screenshots. This
composes the homepage headline with the stacked boards from the room section,
not the interactive room illustration, using only
the committed local assets; no Stadiate hub is needed. Commit the generated
image with the metadata. For future replacements, increment the `v1` filename
in both image meta tags before generating to avoid reusing cached image URLs.
Messaging services can still cache previously shared page previews after deploy.
