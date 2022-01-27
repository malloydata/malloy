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

import { doBuild, outDir } from "./build-extension";
import * as fs from "fs";
import * as path from "path";
import { createVSIX } from "vsce";

// TODO
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

export async function doPackage(
  target: Target,
  version?: string
): Promise<void> {
  const nativeKeytarFile = targetInfo[target];
  if (!nativeKeytarFile) throw new Error("Invalid target");

  await doBuild();

  // copy target-specific keytar binary into build
  fs.copyFileSync(
    path.join(
      "..",
      "..",
      "third_party",
      "github.com",
      "atom",
      "node-keytar",
      nativeKeytarFile
    ),
    path.join(outDir, "keytar-native")
  );

  // get version info from package.json if it isn't passed in
  if (!version) {
    const packageJSON = JSON.parse(
      fs.readFileSync(path.join("package.json"), "utf8")
    );
    version = packageJSON.version;
  }

  await createVSIX({
    githubBranch: "main",
    preRelease: false,
    useYarn: true,
    target,
    packagePath: path.join(outDir, `malloy-vscode-${target}-${version}.vsix`),
  });
}

doPackage("darwin-x64");
