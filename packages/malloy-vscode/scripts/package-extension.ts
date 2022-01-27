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

import { doBuild, outDir, Target } from "./build-extension";
import * as fs from "fs";
import * as path from "path";
import { createVSIX } from "vsce";

export async function doPackage(
  target?: Target,
  version?: string
): Promise<string> {
  await doBuild(target);

  // get version info from package.json if it isn't passed in
  if (!version) {
    const packageJSON = JSON.parse(
      fs.readFileSync(path.join("package.json"), "utf8")
    );
    version = packageJSON.version;
  }

  const packagePath = path.join(
    outDir,
    `malloy-vscode-${target}-${version}.vsix`
  );
  await createVSIX({
    githubBranch: "main",
    preRelease: false,
    useYarn: true,
    target,
    packagePath,
  });

  return packagePath;
}

const args = process.argv.slice(2);
if (args[0] == "package") {
  const target = args[1] ? (args[1] as Target) : undefined;
  console.log(
    target
      ? `Packaging extension for ${target}`
      : "Packaging extension with no target specified, using current machine as target"
  );

  doPackage(target)
    .then(() => {
      console.log("Extension packaged successfully");
    })
    .catch((error) => {
      console.error("Extension packaged with errors");
      console.log(error);
      process.exit(1);
    });
}
