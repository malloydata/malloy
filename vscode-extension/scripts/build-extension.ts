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
import { build, Plugin } from "esbuild";
import { nativeNodeModulesPlugin } from "../../third_party/github.com/evanw/esbuild/native-modules-plugin";
import * as path from "path";
import { execSync } from "child_process";
import { noNodeModulesSourceMaps } from "../../third_party/github.com/evanw/esbuild/no-node-modules-sourcemaps";
import svgrPlugin from "esbuild-plugin-svgr";

import duckdbPackage from "@malloydata/db-duckdb/package.json";
import { generateDisclaimer } from "../../scripts/license_disclaimer";
const DUCKDB_VERSION = duckdbPackage.dependencies.duckdb;

export type Target =
  | "linux-x64"
  | "linux-arm64"
  | "linux-armhf"
  | "alpine-x64"
  | "alpine-arm64"
  | "darwin-x64"
  | "darwin-arm64"
  | "win32-x64";

export type BinaryTargetMap = { [target in Target]: string };

export const targetKeytarMap: BinaryTargetMap = {
  "linux-x64": "keytar-v7.7.0-napi-v3-linux-x64.node",
  "linux-arm64": "keytar-v7.7.0-napi-v3-linux-arm64.node",
  "linux-armhf": "keytar-v7.7.0-napi-v3-linux-ia32.node",
  "alpine-x64": "keytar-v7.7.0-napi-v3-linuxmusl-x64.node",
  "alpine-arm64": "keytar-v7.7.0-napi-v3-linuxmusl-arm64.node",
  "darwin-x64": "keytar-v7.7.0-napi-v3-darwin-x64.node",
  "darwin-arm64": "keytar-v7.7.0-napi-v3-darwin-arm64.node",
  "win32-x64": "keytar-v7.7.0-napi-v3-win32-x64.node",
};

export const targetDuckDBMap: Partial<BinaryTargetMap> = {
  "darwin-arm64": `duckdb-v${DUCKDB_VERSION}-node-v93-darwin-arm64.node`,
  "darwin-x64": `duckdb-v${DUCKDB_VERSION}-node-v93-darwin-x64.node`,
  "linux-x64": `duckdb-v${DUCKDB_VERSION}-node-v93-linux-x64.node`,
  "win32-x64": `duckdb-v${DUCKDB_VERSION}-node-v93-win32-x64.node`,
};

export const outDir = "dist/";

// This plugin replaces keytar's attempt to load the keytar.node native binary (built in node_modules
// on npm install) with a require function to load a .node file from the filesystem
const keytarReplacerPlugin: Plugin = {
  name: "keytarReplacer",
  setup(build) {
    build.onResolve({ filter: /build\/Release\/keytar.node/ }, (args) => {
      return {
        path: args.path,
        namespace: "keytar-replacer",
      };
    });
    build.onLoad(
      { filter: /build\/Release\/keytar.node/, namespace: "keytar-replacer" },
      (_args) => {
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

function makeDuckdbNoNodePreGypPlugin(target: Target | undefined): Plugin {
  const localPath = require.resolve("duckdb/lib/binding/duckdb.node");
  const isDuckDBAvailable =
    target === undefined || targetDuckDBMap[target] !== undefined;
  return {
    name: "duckdbNoNodePreGypPlugin",
    setup(build) {
      build.onResolve({ filter: /duckdb-binding\.js/ }, (args) => {
        return {
          path: args.path,
          namespace: "duckdb-no-node-pre-gyp-plugin",
        };
      });
      build.onLoad(
        {
          filter: /duckdb-binding\.js/,
          namespace: "duckdb-no-node-pre-gyp-plugin",
        },
        (_args) => {
          return {
            contents: `
              var path = require("path");
              var os = require("os");

              var binding_path = ${
                target
                  ? `require.resolve("./duckdb-native.node")`
                  : `"${localPath}"`
              };

              // dlopen is used because we need to specify the RTLD_GLOBAL flag to be able to resolve duckdb symbols
              // on linux where RTLD_LOCAL is the default.
              process.dlopen(module, binding_path, os.constants.dlopen.RTLD_NOW | os.constants.dlopen.RTLD_GLOBAL);
            `,
            resolveDir: ".",
          };
        }
      );
      build.onResolve({ filter: /duckdb_availability/ }, (args) => {
        return {
          path: args.path,
          namespace: "duckdb-no-node-pre-gyp-plugin",
        };
      });
      build.onLoad(
        {
          filter: /duckdb_availability/,
          namespace: "duckdb-no-node-pre-gyp-plugin",
        },
        (_args) => {
          return {
            contents: `
              export const isDuckDBAvailable = ${isDuckDBAvailable};
            `,
            resolveDir: ".",
          };
        }
      );
      if (!isDuckDBAvailable) {
        build.onResolve({ filter: /^duckdb$/ }, (args) => {
          return {
            path: args.path,
            namespace: "duckdb-no-node-pre-gyp-plugin",
          };
        });
        build.onLoad(
          { filter: /^duckdb$/, namespace: "duckdb-no-node-pre-gyp-plugin" },
          (_args) => {
            return {
              contents: `
              module.exports = {};
            `,
              resolveDir: ".",
            };
          }
        );
      }
    },
  };
}

const DEFINITIONS: Record<string, string> = {};

const ENV_PASSTHROUGH = ["GA_API_SECRET", "GA_MEASUREMENT_ID"];

for (const variable of ENV_PASSTHROUGH) {
  DEFINITIONS[`process.env.${variable}`] = JSON.stringify(
    process.env[variable]
  );
}

// building without a target does a default build using whatever keytar native lib is in node_modules
export async function doBuild(target?: Target): Promise<void> {
  const development = process.env.NODE_ENV == "development";

  if (target && !targetKeytarMap[target])
    throw new Error(`Invalid target: ${target}`);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const fullLicenseFilePath = path.join(
    __dirname,
    "..",
    outDir,
    "third_party_notices.txt"
  );

  if (fs.existsSync(fullLicenseFilePath)) {
    fs.rmSync(fullLicenseFilePath);
  }
  generateDisclaimer(
    path.join(__dirname, "..", "package.json"),
    path.join(__dirname, "..", "..", "node_modules"),
    fullLicenseFilePath
  );

  fs.writeFileSync(
    path.join(outDir, "build-sha"),
    execSync("git rev-parse HEAD")
  );

  // copy the README.md from the root to this package. vsce does not provide a way to specifiy a readme path in the "manifest",
  // the only option is to put a readme file at the root of the package :(
  fs.copyFileSync(path.join("..", "README.md"), "README.md");

  // same story as README, but this time it's CHANGELOG
  fs.copyFileSync(path.join("..", "CHANGELOG.md"), "CHANGELOG.md");

  if (target) {
    fs.copyFileSync(
      path.join(
        "..",
        "third_party",
        "github.com",
        "atom",
        "node-keytar",
        targetKeytarMap[target]
      ),
      path.join(outDir, "keytar-native.node")
    );
    const duckDBBinaryName = targetDuckDBMap[target];
    const isDuckDBAvailable = duckDBBinaryName !== undefined;
    if (isDuckDBAvailable) {
      fs.copyFileSync(
        path.join(
          "..",
          "third_party",
          "github.com",
          "duckdb",
          "duckdb",
          duckDBBinaryName
        ),
        path.join(outDir, "duckdb-native.node")
      );
    }
  }
  const duckDBPlugin = makeDuckdbNoNodePreGypPlugin(target);
  const extensionPlugins = [duckDBPlugin];
  // if we're building with a target, replace keytar imports using plugin that imports
  // binary builds of keytar. if we're building for dev, use a .node plugin to
  // ensure ketyar's node_modules .node file is in the build
  if (target) {
    extensionPlugins.push(keytarReplacerPlugin);
  } else {
    extensionPlugins.push(nativeNodeModulesPlugin);
  }
  if (development) extensionPlugins.push(noNodeModulesSourceMaps);

  // build the extension and server
  await build({
    entryPoints: [
      "./src/extension/extension.ts",
      "./src/server/server.ts",
      "./src/worker/worker.ts",
    ],
    entryNames: "[name]",
    bundle: true,
    minify: !development,
    sourcemap: development,
    outdir: outDir,
    platform: "node",
    external: [
      "vscode",
      "pg-native",
      "./keytar-native.node",
      "./duckdb-native.node",
    ],
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
    define: DEFINITIONS,
  });

  const webviewPlugins = [
    svgrPlugin({
      typescript: true,
    }),
    duckDBPlugin,
  ];

  if (development) {
    webviewPlugins.push(noNodeModulesSourceMaps);
  }

  // build the webviews
  await build({
    entryPoints: [
      "./src/extension/webviews/query_page/entry.ts",
      "./src/extension/webviews/connections_page/entry.ts",
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
