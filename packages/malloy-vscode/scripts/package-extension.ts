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
import * as path from "path";
import * as semver from "semver";
import { createVSIX } from "vsce";

// importing this in normal fashion seems to import an older API?!
// for ex, when imported, "Property 'rmSync' does not exist on type 'typeof import("fs")'"
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");

export async function doPackage(
  target?: Target,
  version?: string,
  preRelease = false
): Promise<string> {
  await doBuild(target);

  const packagePath = path.join(
    outDir,
    target
      ? `malloy-vscode-${target}-${version}.vsix`
      : `malloy-vscode-${version}.vsix`
  );

  // vsce uses package.json as a manifest, and has no way to pass in a version - it only reads
  // version info from package.json. This is annoying for many reasonas, but particularly for
  // CI & for managing production vs pre-release versions progarmmatically.
  //
  // the hack here is to load package.json, change the version, write it out, package the VSIX,
  // then replace package.json with the original version. :(
  const packageJSON = JSON.parse(fs.readFileSync("package.json", "utf8"));

  if (!version) version = packageJSON.version; // get version info from package.json if it isn't passed in
  if (!semver.valid(version)) throw new Error(`Invalid semver: ${version}`);

  fs.copyFileSync("package.json", "package.json.original");

  packageJSON.version = version;
  fs.writeFileSync("package.json", JSON.stringify(packageJSON));

  try {
    await createVSIX({
      githubBranch: "main",
      preRelease,
      useYarn: true,
      target,
      packagePath,
    });
  } finally {
    fs.copyFileSync("package.json.original", "package.json");
    fs.rmSync("package.json.original");
  }

  return packagePath;
}

const args = process.argv.slice(2);
if (args[0] == "package") {
  const target = args[1] ? (args[1] as Target) : undefined;
  const version = args[2];
  console.log(
    target
      ? `Packaging extension for ${target}`
      : "Packaging extension with no target specified, using current machine as target"
  );

  doPackage(target, version)
    .then(() => {
      console.log("Extension packaged successfully");
    })
    .catch((error) => {
      console.error("Extension packaged with errors");
      console.log(error);
      process.exit(1);
    });
}
