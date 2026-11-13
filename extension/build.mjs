import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

const output = new URL("./dist/", import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of ["content", "background", "popup", "settings"]) {
  await build({
    entryPoints: [new URL(`./${entry}.ts`, import.meta.url).pathname],
    outfile: new URL(`./dist/${entry}.js`, import.meta.url).pathname,
    bundle: true,
    platform: "browser",
    target: "chrome120",
    format: "iife",
  });
}

for (const file of ["manifest.json", "popup.html", "settings.html", "styles.css", "popup.css", "settings.css"]) {
  await cp(new URL(`./${file}`, import.meta.url), new URL(`./dist/${file}`, import.meta.url));
}
