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

import { doBuild } from "./build-extension";
import * as fs from "fs";
import * as path from "path";

type Target =
  | "linux-x64"
  | "linux-arm64"
  | "linux-armhf"
  | "alpine-x64"
  | "alpine-arm64"
  | "darwin-x64"
  | "darwin-arm64";

interface TargetInfo {
  target: Target;
  keytarBinaryFilename: string;
}

const targetInfo: { [id: string]: SimpleLayer } = {};

export async function doPackage(target: string): Promise<void> {
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
      filename
    ),
    path.join(outDir, "keytar-native")
  );

  const vsixOptions: ICreateVSIXOptions = {
    githubBranch: "main",
    preRelease: false,
    useYarn: true,
    target,
    packagePath: path.join(outDir, `malloy-vscode-${target}-${version}`),
  };
  await createVSIX(vsixOptions);
}
