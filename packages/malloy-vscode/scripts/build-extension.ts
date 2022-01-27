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

export const outDir = "dist";
const development = process.env.NODE_ENV == "development";

const keytarReplacerPlugin = {
  name: "keytarReplacer",
  setup(build: any) {
    build.onResolve({ filter: /keytar/ }, (args: any) => ({
      path: args.path,
      namespace: "keytar-replacer",
    }));
    build.onLoad(
      { filter: /keytar/, namespace: "keytar-replacer" },
      (args: any) => {
        console.log("match");
        return {
          contents: "butts",
        };
      }
    );
  },
};

export async function doBuild(): Promise<void> {
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
    external: ["vscode", "pg-native"],
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
