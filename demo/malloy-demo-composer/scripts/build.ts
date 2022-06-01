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
    plugins: [makeDuckdbNoNodePreGypPlugin(undefined), ignorePgNativePlugin],
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

function makeDuckdbNoNodePreGypPlugin(target: string | undefined) {
  const localPath = require.resolve("duckdb/lib/binding/duckdb.node");
  return {
    name: "duckdbNoNodePreGypPlugin",
    setup(build: any) {
      build.onResolve({ filter: /duckdb-binding\.js/ }, (args: any) => {
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
        (_args: any) => {
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
    },
  };
}

const ignorePgNativePlugin = {
  name: "ignorePgNativePlugin",
  setup(build: any) {
    build.onResolve({ filter: /pg-native/ }, (args: any) => {
      return {
        path: args.path,
        namespace: "ignore-pg-native-plugin",
      };
    });
    build.onLoad(
      {
        filter: /pg-native/,
        namespace: "ignore-pg-native-plugin",
      },
      (_args: any) => {
        return {
          contents: ``,
          resolveDir: ".",
        };
      }
    );
  },
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
