/*
 * Copyright 2022 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */
/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import { build, BuildOptions, serve } from "esbuild";
import { argv } from "process";

const samplePath = path.join(__dirname, "..", "..", "..", "samples", "duckdb");
const outDir = path.join(__dirname, "..", "docs", "dist");
fs.mkdirSync(outDir, { recursive: true });

const namesDb = path.join(samplePath, "names", "data", "usa_names.parquet");
fs.copyFileSync(namesDb, path.join(outDir, "usa_names.parquet"));
const airportsDb = path.join(samplePath, "faa", "data", "airports.parquet");
fs.copyFileSync(airportsDb, path.join(outDir, "airports.parquet"));
const autoRecallDb = path.join(samplePath, "auto_recalls", "auto_recalls.csv");
fs.copyFileSync(autoRecallDb, path.join(outDir, "auto_recalls.csv"));

let port: number | undefined;

export async function doBuild(): Promise<void> {
  const development = process.env.NODE_ENV == "development";

  const options: BuildOptions = {
    define: { "process.env.NODE_DEBUG": "false" },
    entryPoints: {
      main: "./src/index.tsx",
      "editor.worker": "monaco-editor/esm/vs/editor/editor.worker.js",
      "ts.worker": "monaco-editor/esm/vs/language/typescript/ts.worker",
    },
    entryNames: "[name].bundle",
    bundle: true,
    minify: !development,
    sourcemap: false,
    outdir: "docs/dist/",
    platform: "browser",
    loader: { [".png"]: "file", [".svg"]: "file", [".ttf"]: "file" },
    watch:
      development && !port
        ? {
            onRebuild(error, result) {
              if (error) console.error("Extension server build failed:", error);
              else console.log("Extension server build succeeded:", result);
            },
          }
        : false,
  };

  if (port) {
    console.log(`Listening on port ${port}`);
    await serve({ port, servedir: "docs" }, options);
  } else {
    await build(options);
  }
}

if (argv.length > 2) {
  try {
    port = parseInt(argv[2]);
  } catch {
    console.error(`Invalid port ${port}`);
    process.exit(1);
  }
}

doBuild()
  .then(() => {
    console.log("Built successfully");
  })
  .catch((error) => {
    console.error("Built with errors");
    console.log(error);
    if (!port) {
      process.exit(1);
    }
  });
