# Copilot instructions — stadiate-site

Public marketing site for **Stadiate**, an Apple TV sports app with an optional Mac
server. This repo is the website only; the product lives in a separate private repo.
`README.md` carries the authoritative product-claims rules — read it before editing copy.

## Commands

Static site, no build step and no bundler. `package.json` exists only for tooling.

```bash
npm ci
npm run dev        # tools/server.mjs → http://127.0.0.1:4173
npm test           # node --test tools/site.test.mjs (Playwright + ephemeral server)
npx playwright install chromium   # one-time, if Chromium is missing
BASE=http://localhost:8787 npm run screenshots   # needs a running Stadiate hub
npm run og         # rebuild assets/og.jpg from the live-board capture
BASE=http://localhost:8787 npm run screenshots:drive   # room-demo drive capture
```

Run a single test by name:

```bash
node --test --test-name-pattern='room demo is local-only' tools/site.test.mjs
```

There is no linter. `npm test` is the only gate, and it is strict: it fails on any
console error, any HTTP 4xx/5xx for a page asset, horizontal overflow at 320–1440px,
or a `#`-anchor with no matching element. Run it after touching HTML, CSS, or JS.

Deploy is **GitHub Pages**, built from `main` at the repository root — no build
config, live within about a minute of a push. `CNAME` is load-bearing: it holds the
custom domain, so don't move or delete it. Cloudflare supplies DNS and the analytics
beacon but does not host or proxy the site, which is why the beacon is hand-written
into each page. Check state with `gh api repos/BensBar/stadiate-site/pages`.

## Architecture

`index.html` + `privacy.html` + `assets/` + `tools/`. Everything is self-hosted —
CSS, JS, Cinzel font (`assets/fonts/`, OFL license alongside), and product captures.
No CDN, no external embeds, no runtime calls to the product API. The single
third-party script is the cookieless Cloudflare Web Analytics beacon.

`tools/server.mjs` exports `startServer(port)` and is shared by `npm run dev` and the
test suite. It serves only `index.html`, `privacy.html`, and `assets/**`, and maps
`/privacy` → `privacy.html` (matching how Pages serves extensionless URLs). A test
asserts `/.git/config`
returns 404, so don't widen that allowlist.

`assets/site.js` has two halves:

- **Top level** — the board **view picker** (`views` map, 4 entries), the **Art View**
  scene picker (`artScenes`, 4 entries), and the `<dialog>` **lightbox**. Each picker
  owns its screenshot filename, title, description, platform label, and alt text in a
  JS object; the matching `<button data-view>` / `<button data-art>` in HTML carries
  only the key. Add a view or scene in **both** places or the test loop fails.
- **An IIFE** — everything driven by team data: synthesized audio, the confetti
  canvas, the room demo, and the team gallery.

`assets/teams.js` is **generated data**, not hand-authored. It sets one global,
`window.STADIATE_TEAMS = { nfl: [...], ncaaf: [...] }`, with terse keys: `n` full name,
`s` short name, `m` mascot, `a` abbreviation, `c1`/`c2` ESPN colors, `img` crest path,
plus `conf`/`rank` for NCAAF. Both scripts are `defer`red, with `teams.js` first.

### Progressive enhancement is enforced

Interactive widgets ship hidden (`.view-picker`, `.art-picker`, `#room-demo` have
`hidden` in the HTML) and JS clears `hidden` on startup. Each has a `<noscript>`
`.no-script` block linking the full-size images directly. Two tests load the page with
`javaScriptEnabled: false` and assert the comparison table, the no-script fallbacks,
and the privacy link all still work. Never add a feature that is unreachable without JS.

### The room demo is an illustration, not a product call

`#room-scene` is pure CSS + WebAudio. Sounds are synthesized from oscillators and a
noise buffer for the optional team/event buttons; the featured video carries
recorded Falcons audio in its AAC track. The `EV` map (`td`/`fg`/`win`/`rival`)
defines word, flash count, sound, confetti count, and caption; `play()` sequences it
through `later()` timers collected in `timers` so `reset()` can cancel a half-finished
celebration. A test installs a fake clock, replays it twice, and asserts **zero
non-GET requests** — the demo must never hit a network endpoint.

Critically, the celebration plays on the **framed art TV on the side wall**
(`.r-art #tko-img`); the main TV keeps showing the game. A test asserts
`.r-tv .tko` has zero elements. The site never claims to take over your broadcast.

Colors flow one way: team data → CSS custom properties (`--c1`, `--c2`, `--gl`, `--gr`,
`--lit`). `site.css` declares these with `@property` so they can be *animated* as
colors and numbers; replacing them with plain variables breaks the light transitions.

`matchMedia('(prefers-reduced-motion: reduce)')` is read once into `reduced`. Every
animation, auto-advance, confetti burst, shake, and the auto-preview must honor it.

### Screenshots are provenanced, not decorative

`assets/shots/*.jpg` are real captures of the current web board renderer showing
**real October 3–4, 2026 final results** (New England 29–26 Buffalo;
Georgia 38–14 Vanderbilt). `capture.json` records source URLs, event IDs, scores,
player stats, capture time, and a **SHA-256 per file** — a test re-hashes every image
and fails on mismatch. So: regenerate images and `capture.json` together via
`npm run screenshots`, never hand-edit either.
The additional Cathedral preview uses `npm run screenshots:cathedral` and
`cathedral-capture.json`, without changing the original ten captures.

The main TV plays H.264/AAC video from `data-clip`, with original game audio
and Stadiate's actual `falcons-thunder.mp3` mixed into the same track at 13s.
Keep game audio at full volume through 14.5s, with the horn at 10% underneath.
Crossfade over the next 0.5s to full horn and 25% game audio, after the full call.
Muted inline autoplay is attempted when it enters view; a direct Play with sound
tap starts/unmutes it, including when iPhone blocks autoplay. Reduced motion
waits for that tap. Use media `currentTime` for the `data-td-at` cue (13s), not
a wall timer. Stop/page hiding cancels playback; native pause must not trigger
the scoring cue. All video and audio end at 17.5s, after 4.5s of horn, and
`ended` clears room effects. Do not synthesize another horn over the recording.
Playback and sound controls belong below the TV, never over the footage.
The preview server must support MP4 MIME and byte ranges for Safari.
The real first-frame poster covers the idle TV before/after playback.
Load failures use `assets/shots/drive-capture.json` instead: the ball moves to each
play's `data-yd`, reaching the end zone on the cue. Keep that fallback markup
generated from the manifest. Extra team/event controls are in a collapsed disclosure.

The site owner confirmed permission to publish the supplied touchdown clip.
`assets/clips/` is git-ignored except for its README and the derived
`bijan-touchdown.mp4`, `falcons-saints-td.gif`, and `falcons-saints-poster.jpg`;
never commit the source MP4 or download replacement
highlights without permission. The conversion command is in that README.
The demo fine print and broadcast-rights FAQ must describe the actual media,
without implying that Stadiate streams games or includes broadcast rights.

The link-preview card `assets/og.jpg` is **derived**, not hand-made: `npm run og`
downscales `live-board.jpg` to 1200×675 after checking it against its recorded hash,
so the share image can't drift from a real capture. Re-run it after `npm run
screenshots`. A test asserts the card is not served from `assets/glass/`, because
shared links must preview as sports, not stained-glass art.

`tools/capture-data.mjs` pulls finals and player stats from public ESPN summaries and
verifies event ID, final status, and score-vs-last-play agreement; incomplete or
inconsistent data throws. `tools/shoot.mjs` loads the product UI in passive view mode,
injects only those historical payloads, blocks the board WebSocket, and blocks/logs
unrelated API calls. It never registers a board, mutates hub config, or fires real
room effects. Scores, names, clocks, and stats are never invented.

## Conventions

- Vanilla JS, no framework, no browser modules (`site.js` is a plain deferred script).
  `tools/*.mjs` is ESM Node and is the only exception.
- Lead with “Don’t just watch the game. Stadiate your house.” Make the touchdown
  demo the primary action and make one-screen starting requirements clear.
  Page order leads with sports: hero room demo → three numbered steps
  → visible scoreboard and Art View previews → optional team gallery
  → two setup choices → brief FAQ → truthful launch/share action.
  Art View is a product differentiator; keep it after the sports sections. For the same
  reason the hero's first visual is the Bijan touchdown on the demo's main TV.
  The New England–Buffalo capture stays in the scoreboard gallery and share card.
  Page chrome uses red, black, silver, and white, with subtle textures
  and slow red-to-silver gradients (28–32 seconds), never rainbow hues.
  Honor reduced motion. Keep the numbered setup steps and board choices.
  Team colors and stained glass belong in product previews and the opt-in gallery.
- Lead with live scores and room celebrations, not Apple TV alone. Offer the
  standalone Apple TV app and Mac-powered boards on compatible browser screens
  as two entry points. Do not promise every browser or other native TV apps.
- Keep the default reading path under 350 words. Additional gallery scenes, the
  full comparison (including fantasy), and demo provenance/play-by-play use native `details`,
  closed by default and accessible without JavaScript. Avoid repeating lists.
- Gallery tiles, timeline chips, and the team `<select>` are built in JS
  from `STADIATE_TEAMS` — don't hardcode team markup in `index.html`.
- Crests: 384×384 transparent WebP (`cwebp -q 82 -alpha_q 90 -resize 384 384`).
  NFL files are slugged names (`nfl/atlanta-falcons.webp`); NCAAF files are
  **ESPN team IDs** (`ncaaf/333.webp`). They are artistic interpretations — trademark
  clearance is still open, so don't expand team-mark usage.
- FAQ entries are native `<details>`/`<summary>`; tests open one by its question text.
- Every new HTML page needs the analytics beacon snippet **exactly once**, immediately
  before `</body>`, and `privacy.html`'s "This website" section must stay accurate.
  A test counts occurrences and asserts zero cookies are set.
- Copy is plain-English and second-person. Keep claims honest and test-checked:
  Use “Stadiate Hub” for the optional Mac software in consumer copy, not “Mac server.”
  Apple TV is standalone-first; Hub on Mac is what adds lights, sounds, coordinated
  boards, capture, and fantasy; fantasy celebrates player scoring events, not point
  totals, and CBS stays labeled EXPERIMENTAL; Stadiate does not stream games or overlay
  other tvOS apps. Preserve the coming-soon release status and never invent store URLs
  or link to the private product repo.
