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

import * as semver from "semver";
import { publishVSIX } from "vsce";
import { Target, targetKeytarMap } from "./build-extension";
import { doPackage } from "./package-extension";

async function doPublish(version: string) {
  let preRelease = false;
  if (version == "pre-release") {
    // NOTE: pre-release is pinned to 0.1 here. We'll need to increment the minor if we
    // ever push production version > 0.0.x
    version = `0.1.${Math.floor(Date.now() / 1000)}`;
    preRelease = true;
  } else if (!semver.valid(version))
    throw new Error(`Invalid semver: ${version}`);

  for (const target in targetKeytarMap) {
    const packagePath = await doPackage(target as Target, version, preRelease);

    await publishVSIX(packagePath, {
      githubBranch: "main",
      preRelease,
      useYarn: true,
      pat: process.env.VSCE_PAT,
    });
  }
}

const args = process.argv.slice(2);
const version = args[0];
if (!version)
  throw new Error(
    "No version passed to publish script. Call it with a semver version or pass 'pre-release'."
  );

console.log(`Publishing extensions with version ${version}`);

doPublish(version)
  .then(() => {
    console.log("Extensions published successfully");
  })
  .catch((error) => {
    console.error("Extension publishing errors:");
    console.log(error);
    process.exit(1);
  });
