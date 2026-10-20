# Original artwork

The focus mark uses four open brackets around a single point. Muted mint, blue-green panels and system fonts keep the interface quiet and the installed package small.

## Files

- `brand/mark.svg`: dark original icon, scalable.
- `brand/mark-light.svg`: icon for light backgrounds.
- `brand/mark-512.png`: 512 px export with transparent outer corners.
- `brand/wordmark.svg`: horizontal name and maker lockup.
- `launch/01-get-started.{svg,png}`: install and setup, 1080 × 1350.
- `launch/02-you-stay-in-control.{svg,png}`: Reveal, source labels and feedback, 1080 × 1350.
- `launch/03-where-data-goes.{svg,png}`: provider, local and network data flows, 1080 × 1350.
- `launch/social-cover.{svg,png}`: project cover, 1200 × 630.

SVGs are editable source; PNGs are ready to share. The guides contain text descriptions in SVG accessibility metadata. Their full text is also available in [Quick start](../docs/QUICKSTART.md) and the [privacy policy](../docs/PRIVACY.md).

Regenerate PNGs using `node scripts/materials.mjs` after `npm ci` and installing Chrome for Testing. Exports use an isolated browser and contain no user data. The script checks text stays within the canvas; visually review exports after changing copy.

All artwork here is original and MIT licensed. X and third-party names identify integrations; they do not imply endorsement. Actual tweet screenshots elsewhere are not covered by our artwork licence.
