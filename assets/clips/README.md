# Room demo clip (optional, not bundled)

The room demo's main TV will play a video here if one is present:

```
assets/clips/falcons-saints-td.mp4
```

Nothing is shipped in this folder, and video files are git-ignored. That is
deliberate. The play the demo is built around is Bijan Robinson's 59-yard
touchdown from Atlanta at New Orleans on October 5, 2026, and the NFL's
highlight of it is neither embeddable (YouTube returns error 153) nor ours to
re-host. **Only drop a file here that you have the right to publish.**

## What the page does

- **Clip present** — the TV plays it with sound. Playback starts inside the
  click on "Play the drive", so browsers allow the audio. If a browser refuses
  sound anyway, it starts muted and shows a "Tap for sound" button.
- **Clip absent** — the TV replays the drive from the verified play-by-play in
  `assets/shots/drive-capture.json`. This is what the public site does today.

Either way the touchdown fires at the cue in `data-td-at` on `#play-drive`
(14 seconds), so the room reacts at the right moment.

## Requirements

- **The touchdown must happen at 14 seconds**, or change `data-td-at` to match.
- H.264/AAC MP4, so it plays everywhere without a JS player.
- 16:9; it is drawn with `object-fit: cover`.
- Keep it small. It loads only on click (`preload="none"`), but it is still
  served from the same GitHub Pages site as the rest of the page.

```bash
ffmpeg -i source.mov -t 24 -c:v libx264 -crf 23 -preset slow \
  -c:a aac -b:a 128k -movflags +faststart \
  assets/clips/falcons-saints-td.mp4
```

If you publish a clip, update the fine print under the demo and the
"Does Stadiate stream the actual game?" FAQ answer, which currently describe
the play-by-play fallback.
