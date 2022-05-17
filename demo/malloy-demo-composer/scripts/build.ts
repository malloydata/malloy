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
/* eslint-disable @typescript-eslint/no-explicit-any */

import { build, BuildOptions } from "esbuild";
import svgrPlugin from "esbuild-plugin-svgr";
import * as path from "path";
import fs from "fs";

export const buildDirectory = "build/";
export const appDirectory = "app/";

export const commonAppConfig = (development = false): BuildOptions => {
  return {
    entryPoints: ["./src/index.tsx"],
    outfile: path.join(buildDirectory, appDirectory, "app.js"),
    minify: !development,
    sourcemap: development,
    bundle: true,
    platform: "browser",
    loader: {
      ".js": "jsx",
      ".png": "file",
    },
    plugins: [svgrPlugin({ exportType: "named" })],
    define: {
      "process.env.NODE_DEBUG": "false", // TODO this is a hack because some package we include assumed process.env exists :(
    },
    inject: ["./react-shim.js"], // This shim elimanites needing to have "require React from 'react'" in every file
  };
};

const commonElectronConfig = (development = false): BuildOptions => {
  return {
    entryPoints: ["./src/electron/main.ts", "./src/electron/preload.ts"],
    outdir: path.join(buildDirectory),
    minify: !development,
    sourcemap: development ? "inline" : false,
    bundle: true,
    platform: "node",
    external: ["electron"],
  };
};

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    entry.isDirectory()
      ? copyDir(srcPath, destPath)
      : fs.copyFileSync(srcPath, destPath);
  }
}

const errorHandler = (e: any) => {
  console.log(e);
  process.exit(1);
};

async function doBuild() {
  //const development = process.env.NODE_ENV == "development";
  const development = true;

  fs.rmSync(buildDirectory, { recursive: true, force: true });
  fs.mkdirSync(buildDirectory, { recursive: true });

  copyDir("public", path.join(buildDirectory, appDirectory));

  await build(commonAppConfig(development)).catch(errorHandler);
  await build(commonElectronConfig(development)).catch(errorHandler);
}

doBuild();
