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
import { nativeNodeModulesPlugin } from "../../../third_party/github.com/evanw/esbuild/native-modules-plugin";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

type Target =
  | "linux-x64"
  | "linux-arm64"
  | "linux-armhf"
  | "alpine-x64"
  | "alpine-arm64"
  | "darwin-x64"
  | "darwin-arm64";

const targetInfo: { [id: string]: string } = {
  "linux-x64": "DOES NOT EXIST",
  "darwin-x64": "keytar-v7.7.0-napi-v3-darwin-x64.node",
  "darwin-arm64": "keytar-v7.7.0-napi-v3-darwin-arm64.node",
};

export const outDir = "dist";

// This plugin replaces keytar's attempt to load the keytar.node native binary built in node_modules
// with a raw require function to load from the local filesystem
const keytarReplacerPlugin = {
  name: "keytarReplacer",
  setup(build: any) {
    build.onResolve({ filter: /build\/Release\/keytar.node/ }, (args: any) => {
      return {
        path: args.path,
        namespace: "keytar-replacer",
      };
    });
    build.onLoad(
      { filter: /build\/Release\/keytar.node/, namespace: "keytar-replacer" },
      (args: any) => {
        return {
          contents: `
            try { module.exports = require('./keytar-native.node')}
            catch {}
          `,
        };
      }
    );
  },
};

export async function doBuild(target?: Target): Promise<void> {
  // if a target isnt passed, development mode is assumed
  const development = target ? process.env.NODE_ENV == "development" : true;

  fs.rmdirSync(outDir, { recursive: true });
  fs.mkdirSync(outDir);

  fs.writeFileSync(
    path.join(outDir, "third_party_notices.txt"),
    development
      ? "Third party notices are not produced during development builds to speed up the build."
      : execSync("yarn licenses generate-disclaimer --prod", { stdio: "pipe" })
  );

  const copyFiles = ["language.json"];
  copyFiles.forEach((file) => fs.copyFileSync(file, path.join(outDir, file)));

  if (!development) {
    fs.copyFileSync(
      path.join(
        "..",
        "..",
        "third_party",
        "github.com",
        "atom",
        "node-keytar",
        "keytar-v7.7.0-napi-v3-darwin-x64.node"
      ),
      path.join(outDir, "keytar-native.node")
    );
  }

  // if we're building for production, replace keytar imports using plugin that imports
  // binary builds of keytar
  const plugins = development
    ? [nativeNodeModulesPlugin]
    : [keytarReplacerPlugin];

  await build({
    entryPoints: ["./src/extension/extension.ts", "./src/server/server.ts"],
    entryNames: "[name]",
    bundle: true,
    minify: !development,
    sourcemap: development,
    outdir: outDir,
    platform: "node",
    external: ["vscode", "pg-native", "./keytar-native.node"],
    loader: { [".png"]: "file", [".svg"]: "file" },
    plugins,
    watch: development
      ? {
          onRebuild(error, result) {
            if (error) console.error("Extension server build failed:", error);
            else console.log("Extension server build succeeded:", result);
          },
        }
      : false,
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
  });
}

const args = process.argv.slice(2);
if (args[0] == "build") {
  console.log("Building extension");
  doBuild()
    .then(() => {
      console.log("Extension built successfully");
    })
    .catch((error) => {
      console.error("Extension built with errors");
      console.log(error);
      process.exit(1);
    });
}
