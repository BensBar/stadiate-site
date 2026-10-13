# Room demo media

The main TV plays `bijan-touchdown.mp4`, converted from the locally
supplied `falcons-saints-td.mp4` with the original game audio and Stadiate's actual
Falcons touchdown recording. The site owner confirmed permission to publish
this clip. That permission applies to this supplied footage, not other highlights.
Do not download or re-host replacement footage without permission.

The derived video, poster, and earlier GIF conversion are included; the source
MP4 remains git-ignored. Reproduce the 640 x 360 H.264/AAC MP4 with
`FALCONS_HORN` set to the local product's `sounds/falcons-thunder.mp3`:

```bash
ffmpeg -i assets/clips/falcons-saints-td.mp4 -i "$FALCONS_HORN" \
  -filter_complex "[0:v]scale=640:-2:flags=lanczos,fps=30[v];[0:a]atrim=duration=17.5,volume='if(gte(t,14.5),max(0.25,1-1.5*(t-14.5)),1)':eval=frame[game];[1:a]atrim=duration=4.5,asetpts=PTS-STARTPTS,volume='if(gte(t,1.5),min(1,0.1+1.8*(t-1.5)),0.1)':eval=frame,afade=t=out:st=4.35:d=0.15,adelay=13000|13000[horn];[game][horn]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95:level=false:latency=true,afade=t=out:st=17.35:d=0.15[a]" \
  -map '[v]' -map '[a]' -t 17.5 \
  -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 25 -preset medium \
  -c:a aac -b:a 128k -movflags +faststart assets/clips/bijan-touchdown.mp4
```

The roughly 2.1 MB video uses native inline playback. Autoplay is muted;
"Play with sound" starts/unmutes it directly in the tap handler. When autoplay
is blocked (including iPhone power-saving restrictions), a play button remains
below the TV. No controls cover the footage. The local server must serve
`video/mp4` and support byte ranges.

The touchdown follows `currentTime` at the 13-second cue, not a wall timer.
Pausing or buffering cannot trigger the room early. Stop and page hiding cancel
playback and room effects. The first 4.5 seconds of `falcons-thunder.mp3` are
mixed into the AAC track at 13 seconds. Keep the announcer at full volume
through 14.5 seconds so his complete touchdown call stays audible; the train
starts underneath at 10% volume. From 14.5 to 15 seconds, smoothly raise the
train to full volume while lowering game audio to 25%.
Both video and audio end at 17.5 seconds, and the final 150 ms fade out.
Using one media clock keeps the horn synchronized through buffering, pausing,
muting, and replay. The demo does not add a synthesized horn over this track.

The earlier 400 x 225, 10 fps, 64-color GIF remains available, but is not the
main player because it has no audio or native playback controls:

```bash
ffmpeg -i assets/clips/falcons-saints-td.mp4 \
  -filter_complex "fps=10,scale=400:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none" \
  -loop -1 assets/clips/falcons-saints-td.gif
```

`falcons-saints-poster.jpg` is the source clip's first frame, displayed before
and after playback. Generate it with:

```bash
ffmpeg -i assets/clips/falcons-saints-td.mp4 -frames:v 1 \
  -vf "scale=800:-1:flags=lanczos" -q:v 3 assets/clips/falcons-saints-poster.jpg
```

Reduced motion shows the poster and requires an explicit Play click for the video.
A load failure uses the captured play-by-play instead.
Without JavaScript, the page offers a direct MP4 link and the drive text.
Update the demo fine print and broadcast-rights FAQ whenever the media changes.
