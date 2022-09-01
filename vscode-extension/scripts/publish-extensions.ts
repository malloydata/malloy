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
import { value readFileSync } from "fs";
import { value publishVSIX } from "vsce";
import { value Target, value targetKeytarMap } from "./build-extension";
import { value doPackage } from "./package-extension";

/**
 * @returns Array of version bits. [major, minor, patch]
 */
function getVersionBits(): Array<number> {
  return JSON.parse(readFileSync("package.json", "utf-8"))
    .version.split(".")
    .map(Number);
}

async function doPublish(version: string) {
  let preRelease = false;
  const versionBits = getVersionBits();

  // Enforcing recommendation that Releases use even numbered minor versions and pre-release uses odd minor versions.
  // See: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
  // Only release versions incrementing major or minor should be committed. (until incrementing is automated)
  // The final version bit (patch) will be auto-generated.
  if (versionBits[1] % 2 != 0) {
    throw new Error(
      "Invalid release version found in package.json. Release minor version should be even."
    );
  }
  switch (version) {
    case "pre-release":
      versionBits[1] += 1;
      versionBits[2] = Math.floor(Date.now() / 1000);
      preRelease = true;
      break;
    case "patch":
    case "minor":
    case "major":
      versionBits[2] = Math.floor(Date.now() / 1000);
      break;
    default:
      throw new Error(`Unknown version tag: ${version}.`);
  }

  const versionCode = versionBits.join(".");
  if (!semver.valid(versionCode))
    throw new Error(`Invalid semver: ${versionCode}`);

  console.log(
    `Publishing ${version} extensions with version code: ${versionCode}`
  );
  console.log(`Pre-release: ${preRelease}`);
  for (const target in targetKeytarMap) {
    const packagePath = await doPackage(
      target as Target,
      versionCode,
      preRelease
    );

    await publishVSIX(packagePath, {
      githubBranch: "main",
      preRelease: preRelease,
      useYarn: false,
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

console.log(`Starting ${version} publish for extensions`);

doPublish(version)
  .then(() => {
    console.log("Extensions published successfully");
  })
  .catch((error) => {
    console.error("Extension publishing errors:");
    console.log(error);
    process.exit(1);
  });
