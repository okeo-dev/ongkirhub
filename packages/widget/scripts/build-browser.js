import * as esbuild from "esbuild";
import { mkdirSync } from "fs";

mkdirSync("bundle", { recursive: true });

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "bundle/ongkirhub-widget.js",
  format: "iife",
  globalName: "OngkirHubWidget",
  minify: true,
  platform: "browser",
});

console.log("Browser bundle: bundle/ongkirhub-widget.js");
