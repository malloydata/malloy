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

import { doBuild, outDir, Target, targetInfo } from "./build-extension";
import * as fs from "fs";
import * as path from "path";
import { createVSIX } from "vsce";

export async function doPackage(
  target: Target,
  version?: string
): Promise<void> {
  const nativeKeytarFile = targetInfo[target];
  if (!nativeKeytarFile) throw new Error("Invalid target");

  await doBuild(target);

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
