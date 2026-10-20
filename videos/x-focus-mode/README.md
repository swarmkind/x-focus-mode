# Video source — development composition

**Not the final preview.** The current recordings use fictional feed posts and a scripted model. The requested final video must replace them with real public X posts and recorded extension interactions. Live capture is pending access to an authorized dedicated window or supplied footage.

The composition is 60 seconds, 1920×1080, silent with visible captions and an SRT sidecar. It includes actual extension recordings, settings and explicit provenance. No live model accuracy or organic community participation is implied.

## Rebuild the development reference

From the repository root, install dependencies, start the disposable local relay, and run `npm run demo:capture`. Capture requires Playwright Chromium, its FFmpeg encoder (`npx playwright install ffmpeg`) and system `ffmpeg`. It clears only the local emulator's report table.

Then:

```sh
cd videos/x-focus-mode
npm ci
cd ../..
node demo/build-video.mjs
cd videos/x-focus-mode
npm run check
npm run dev -- --background
```

The pinned renderer can produce a development reference with `npm run render -- --quality delivery --fps 30 --output renders/video.mp4`. Do not publish that fixture render as the requested live preview. Replace source clips, update captions/provenance, run the full check and inspect rendered frames before delivering the final video.

`capture/cuts.json` records source provenance. `proof/contact-sheet.jpg` shows the development composition. Generated MP4s, temporary renderer files and dependency directories are excluded from Git.

The animation library is a video authoring dependency only. See [third-party notices](../../THIRD-PARTY-NOTICES.md).
