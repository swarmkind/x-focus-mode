# X Focus Mode — real-X demo

60 seconds, 1920 × 1080, 30 fps, silent with visible captions and an SRT sidecar. Actual X-window footage demonstrates a local model mistake, Reveal and correction. The final timeline contains no fictional fixture clips. See [capture provenance](capture/live/README.md).

## Rebuild

From the repository root:

```sh
cd videos/x-focus-mode
npm ci
cd ../..
node demo/build-video.mjs
cd videos/x-focus-mode
npm run check
npm run dev -- --background
npm run render -- --quality delivery --fps 30 --output renders/x-focus-mode-0.1.2-demo.mp4
```

Selected, cropped source clips are included; raw window captures remain local. `demo/capture.mjs` builds a separate fictional development fixture and is not needed to rebuild this final demo. Original scene graphics are MIT licensed; recorded posts and third-party media retain their owners' rights.

The animation library is a video authoring dependency only. See [third-party notices](../../THIRD-PARTY-NOTICES.md). The local HyperFrames history is owned by an already-running app; the CLI refused to open a second history owner, so it was not overridden.
