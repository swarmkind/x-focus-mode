import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
execFileSync(process.execPath, ["scripts/build.mjs"], { stdio: "inherit" });
await mkdir("artifacts", { recursive: true });
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const filename = `x-focus-mode-${version}.zip`;
execFileSync("python3", [
  "-c",
  `import pathlib,zipfile,sys
root=pathlib.Path('dist')
with zipfile.ZipFile(sys.argv[1],'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
 for path in sorted(root.rglob('*')):
  if path.is_file():
   info=zipfile.ZipInfo(path.relative_to(root).as_posix(),date_time=(2026,1,1,0,0,0))
   info.compress_type=zipfile.ZIP_DEFLATED
   info.external_attr=0o644<<16
   archive.writestr(info,path.read_bytes())
`,
  `artifacts/${filename}`,
]);
const bytes = await readFile(`artifacts/${filename}`);
await writeFile(
  "artifacts/SHA256SUMS",
  `${createHash("sha256").update(bytes).digest("hex")}  ${filename}\n`,
);
console.log(`${filename}: ${bytes.length} bytes`);
