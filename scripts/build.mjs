import { build } from "esbuild";
import { mkdir, rm, cp, readFile, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
const test = process.argv.includes("--test");
const dest = test ? "artifacts/test-extension" : "dist";
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
for (const entry of [
  "worker",
  "content",
  "metadata",
  "options",
  "offscreen",
  ...(test ? ["store"] : []),
])
  await build({
    entryPoints: [`extension/${entry}.ts`],
    outfile: `${dest}/${entry}.js`,
    bundle: true,
    format: entry === "metadata" || entry === "content" ? "iife" : "esm",
    target: "chrome120",
    minify: !test,
    define: {
      TEST_ORIGIN: JSON.stringify(test ? "http://127.0.0.1:4173" : ""),
    },
  });
for (const file of ["options.html", "options.css", "offscreen.html"])
  await cp(`extension/${file}`, `${dest}/${file}`);
const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));
if (test) {
  manifest.host_permissions.push(
    "http://127.0.0.1/*",
    "https://model.fixture/*",
  );
  for (const s of manifest.content_scripts)
    s.matches.push("http://127.0.0.1/*");
}
await writeFile(
  `${dest}/manifest.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
// Native PNG encoding keeps icon generation reproducible and dependency-free.
function crc32(buffer) {
  let c = 0xffffffff;
  for (const b of buffer) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type),
    len = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
for (const size of [16, 48, 128]) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4,
        d = Math.hypot(x - size / 2, y - size / 2),
        ring = d > size * 0.24 && d < size * 0.33;
      pixels.set(ring ? [180, 219, 196, 255] : [16, 27, 32, 255], i);
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  await writeFile(
    `${dest}/icon${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(pixels)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
console.log(`Built ${dest}`);
