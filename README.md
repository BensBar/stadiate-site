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

The landing page keeps its default reading path under 350 words: the idea,
a hero room demo, three steps, and two ways to start. Scoreboard/Art View galleries,
the feature comparison (including fantasy), team collection, and demo details
use native `details` disclosures, accessible without JavaScript.
Position Stadiate as live scores and room celebrations, not an Apple TV-only
product: Apple TV runs standalone; the Mac app also serves boards to compatible
web browsers without an Apple TV. Do not promise every smart-TV browser or
invent native apps for other platforms.
Black textured surfaces, red controls, and silver/white accents frame the content.
Red-to-silver gradients move slowly (28–32 seconds), without rainbow hues;
reduced motion disables that movement. Team colors stay inside product previews.
Layout tests cap the default page at 4,300px on a 375px-wide phone and 3,500px
at 1440px desktop width, with optional details closed.

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
BASE=http://localhost:8787 npm run screenshots:cathedral
```

The Cathedral capture has its own `cathedral-capture.json`, so adding or
refreshing it leaves the original ten captures and their provenance unchanged.
The Art View picker features The Terrace, Let’s Van Gogh!, The Game-Day Journal,
and Cathedral of the Gridiron. These are website display names, not changes to
the product's theme IDs. The current web catalog has 16 themes: four featured,
12 more available.

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

The room demo's second screen needs one more capture, taken at a single verified
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

### The main TV plays video with game audio

`assets/clips/bijan-touchdown.mp4` is an H.264/AAC conversion of the locally
supplied clip, with its original game audio and an excerpt of Stadiate's
`falcons-thunder.mp3` mixed in at the touchdown. The site owner confirmed permission
to publish this clip. The source file remains git-ignored. A real first-frame
poster and the earlier silent GIF conversion are also retained.
See `assets/clips/README.md` for conversion commands.

The video attempts muted inline playback when the TV enters view. A direct
"Play with sound" tap starts or unmutes it in the user gesture, which iPhone
Safari requires. Blocked autoplay presents the same tap control, not an error
fallback. All playback/sound controls sit below the room, not over the TV.
The preview server supports `video/mp4` and byte-range requests.
Replay restarts the clip; Stop or hiding the page stops it. The touchdown fires
from media playback time at `data-td-at` (13 seconds), so buffering or pausing
cannot run the celebration early. The actual Falcons horn is mixed into the
same AAC track at 13 seconds, with game audio lowered beneath it. The video
and all audio end at 17.5 seconds, after 4.5 seconds of horn; the `ended` handler
also cancels room effects. Do not layer a synthesized horn over this recording.

Reduced-motion visitors see the still frame until they explicitly press Play;
that click plays the video with audio. Failed media loads use verified play-by-play:
the ball travels to each play's `data-yd` yard line, taken from the capture's
`endYardsToEndzone`, and reaches the end zone on the cue. Without JavaScript,
visitors can read the drive and open the MP4 directly. Keep the demo fine print
and broadcast-rights FAQ accurate when changing media.


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
device-control requests. The optional team/event buttons synthesize sounds;
the featured video carries the actual Falcons recording. The main TV
keeps showing the game; the touchdown celebration plays on a separate framed art
screen on a side wall, so the broadcast is never "taken over". Galleries remain static image links without JavaScript;
with JavaScript they gain scene selection and a keyboard-accessible native dialog.
The Cinzel display font is self-hosted with its OFL license in `assets/fonts/`.
Stained-glass team crests live in `assets/glass/` and are indexed by
`assets/teams.js`; they are artistic interpretations, so confirm trademark
clearance for team marks before public launch.
