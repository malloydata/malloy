/*
 * Copyright 2021 Google LLC
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
import { build } from "esbuild";
import { nativeNodeModulesPlugin } from "./third-party/esbuild/native-modules-plugin";
import * as fs from "fs";
import * as path from "path";

const outDir = "dist";

export async function doBuild(): Promise<void> {
  fs.rmdirSync(outDir, { recursive: true });

  await build({
    entryPoints: ["./src/extension/extension.ts", "./src/server/server.ts"],
    entryNames: "[name]",
    bundle: true,
    outdir: outDir,
    platform: "node",
    external: ["vscode", "pg-native"],
    loader: { [".png"]: "file", [".svg"]: "file" },
    plugins: [nativeNodeModulesPlugin],
  }).catch((e: Error) => {
    console.log(e);
    process.exit(1);
  });

  await build({
    entryPoints: [
      "./src/extension/webviews/query_page/entry.ts",
      "./src/extension/webviews/connections_page/entry.ts",
    ],
    entryNames: "[dir]",
    bundle: true,
    outdir: outDir,
    platform: "browser",
    format: "iife",
    loader: { [".svg"]: "file" },
    external: ["crypto"], // TODO this needs a look - locally referenced packages should be only incuding their built code
  }).catch((e: Error) => {
    console.log(e);
    process.exit(1);
  });

  // TODO clean up
  const copyFiles = [
    "language.json",
    path.join("src", "media", "logo.png"),
    path.join("src", "media", "play.svg"),
    path.join("src", "media", "refresh.svg"),
    path.join("src", "media", "database.svg"),
  ];
  if (!fs.existsSync(path.join(outDir, "src")))
    fs.mkdirSync(path.join(outDir, "src"));
  if (!fs.existsSync(path.join(outDir, "src", "media")))
    fs.mkdirSync(path.join(outDir, "src", "media"));

  await copyFiles.forEach((file) =>
    fs.copyFile(file, path.join(outDir, file), (err) => {
      if (err) throw err;
    })
  );
}

doBuild();
