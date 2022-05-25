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
import { build } from "esbuild";
import { nativeNodeModulesPlugin } from "../../../third_party/github.com/evanw/esbuild/native-modules-plugin";
import * as path from "path";
import { execSync } from "child_process";
import { noNodeModulesSourceMaps } from "../../../third_party/github.com/evanw/esbuild/no-node-modules-sourcemaps";
import svgrPlugin from "esbuild-plugin-svgr";

// importing this in normal fashion seems to import an older API?!
// for ex, when imported, "Property 'rmSync' does not exist on type 'typeof import("fs")'"
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");

export type Target =
  | "linux-x64"
  | "linux-arm64"
  | "linux-armhf"
  | "alpine-x64"
  | "alpine-arm64"
  | "darwin-x64"
  | "darwin-arm64";

export type TargetKeytarMap = { [target in Target]: string };

export const targetKeytarMap: TargetKeytarMap = {
  "linux-x64": "keytar-v7.7.0-napi-v3-linux-x64.node",
  "linux-arm64": "keytar-v7.7.0-napi-v3-linux-arm64.node",
  "linux-armhf": "keytar-v7.7.0-napi-v3-linux-ia32.node",
  "alpine-x64": "keytar-v7.7.0-napi-v3-linuxmusl-x64.node",
  "alpine-arm64": "keytar-v7.7.0-napi-v3-linuxmusl-arm64.node",
  "darwin-x64": "keytar-v7.7.0-napi-v3-darwin-x64.node",
  "darwin-arm64": "keytar-v7.7.0-napi-v3-darwin-arm64.node",
};

export const outDir = "dist/";

// This plugin replaces keytar's attempt to load the keytar.node native binary (built in node_modules
// on npm install) with a require function to load a .node file from the filesystem
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
      (_args: any) => {
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

// building without a target does a default build using whatever keytar native lib is in node_modules
export async function doBuild(target?: Target): Promise<void> {
  const development = process.env.NODE_ENV == "development";

  if (target && !targetKeytarMap[target])
    throw new Error(`Invalid target: ${target}`);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const licenseFilePath = path.join(outDir, "third_party_notices.txt");
  if (development) {
    fs.writeFileSync(
      licenseFilePath,
      "Third party notices are not produced during development builds to speed up the build."
    );
  } else {
    const licenseFile = fs.createWriteStream(licenseFilePath);
    licenseFile.on("open", () => {
      execSync("yarn licenses generate-disclaimer --prod", {
        stdio: ["ignore", licenseFile, licenseFile],
      });
    });
    licenseFile.close();
  }

  fs.writeFileSync(
    path.join(outDir, "build-sha"),
    execSync("git rev-parse HEAD")
  );

  // copy the README.md from the root to this package. vsce does not provide a way to specifiy a readme path in the "manifest",
  // the only option is to put a readme file at the root of the package :(
  fs.copyFileSync(path.join("..", "..", "README.md"), "README.md");

  // same story as README, but this time it's CHANGELOG
  fs.copyFileSync(path.join("..", "..", "CHANGELOG.md"), "CHANGELOG.md");

  if (target) {
    fs.copyFileSync(
      path.join(
        "..",
        "..",
        "third_party",
        "github.com",
        "atom",
        "node-keytar",
        targetKeytarMap[target]
      ),
      path.join(outDir, "keytar-native.node")
    );
  }

  // if we're building with a target, replace keytar imports using plugin that imports
  // binary builds of keytar. if we're building for dev, use a .node plugin to
  // ensure ketyar's node_modules .node file is in the build
  // NOTE: adding any additional npm packages that create native libs will require a different strategy
  const extensionPlugins = target
    ? [keytarReplacerPlugin]
    : [nativeNodeModulesPlugin];
  if (development) extensionPlugins.push(noNodeModulesSourceMaps);

  // build the extension and server
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
    plugins: extensionPlugins,
    watch: development
      ? {
          onRebuild(error, result) {
            if (error) console.error("Extension server build failed:", error);
            else console.log("Extension server build succeeded:", result);
          },
        }
      : false,
  });

  const webviewPlugins = [
    svgrPlugin({
      typescript: true,
    }),
  ];

  if (development) {
    webviewPlugins.push(noNodeModulesSourceMaps);
  }

  // build the webviews
  await build({
    entryPoints: [
      "./src/extension/webviews/query_page/entry.ts",
      "./src/extension/webviews/connections_page/entry.ts",
      "./src/extension/webviews/help_page/entry.ts",
    ],
    entryNames: "[dir]",
    bundle: true,
    minify: !development,
    sourcemap: development ? "inline" : false,
    outdir: outDir,
    platform: "browser",
    loader: { [".svg"]: "file" },
    define: {
      "process.env.NODE_DEBUG": "false", // TODO this is a hack because some package we include assumed process.env exists :(
    },
    plugins: webviewPlugins,
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
  console.log(`Building extension to ${outDir}`);

  const target = args[1] ? (args[1] as Target) : undefined;

  doBuild(target)
    .then(() => {
      console.log("Extension built successfully");
    })
    .catch((error) => {
      console.error("Extension built with errors");
      console.log(error);
      process.exit(1);
    });
}
