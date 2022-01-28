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

import { publishVSIX } from "vsce";
import { Target, targetKeytarMap } from "./build-extension";
import { doPackage } from "./package-extension";

async function doPublish(preRelease = false) {
  // get latest version tag

  // temp
  const version = "0.0.5";

  for (const target in targetKeytarMap) {
    const packagePath = await doPackage(target as Target, version, preRelease);

    // await publishVSIX(packagePath, {
    //   githubBranch: "main",
    //   preRelease,
    //   useYarn: true,
    //   target,
    // });
  }

  // bump version, add tag
}
doPublish();
