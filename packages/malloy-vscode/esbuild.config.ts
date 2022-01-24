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
import { nativeNodeModulesPlugin } from "../../third_party/https:/github.com/evanw/esbuild/native-modules-plugin";
import * as fs from "fs";
import * as path from "path";

const outDir = "dist";
const development = process.env.NODE_ENV == "development";

export async function doBuild(): Promise<void> {
  fs.rmdirSync(outDir, { recursive: true });

  await build({
    entryPoints: ["./src/extension/extension.ts", "./src/server/server.ts"],
    entryNames: "[name]",
    bundle: true,
    minify: !development,
    sourcemap: development,
    outdir: outDir,
    platform: "node",
    external: ["vscode", "pg-native"],
    loader: { [".png"]: "file", [".svg"]: "file" },
    plugins: [nativeNodeModulesPlugin],
    watch: development
      ? {
          onRebuild(error, result) {
            if (error) console.error("Extension server build failed:", error);
            else console.log("Extension server build succeeded:", result);
          },
        }
      : false,
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
    minify: !development,
    sourcemap: development,
    outdir: outDir,
    platform: "browser",
    loader: { [".svg"]: "file" },
    define: {
      "process.env.NODE_DEBUG": "false", // TODO this is a hack because some package we include assumed process.env exists :(
    },
    watch: development
      ? {
          onRebuild(error, result) {
            if (error) console.error("Webview build failed:", error);
            else console.log("Webview build succeeded:", result);
          },
        }
      : false,
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
  fs.mkdirSync(path.join(outDir, "src"));
  fs.mkdirSync(path.join(outDir, "src", "media"));

  await copyFiles.forEach((file) =>
    fs.copyFile(file, path.join(outDir, file), (err) => {
      if (err) throw err;
    })
  );
}

console.log("Compiling");
doBuild();
console.log("Compiled successfully");
