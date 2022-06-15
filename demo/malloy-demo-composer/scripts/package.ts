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

import packager from "electron-packager";
import { exit } from "process";

async function packageDemo() {
  const appleId = process.env.NOTARIZER_APPLE_ID;
  const appleIdPassword = process.env.NOTARIZER_APPLE_ID_PASSWORD;
  if (appleId === undefined || appleIdPassword === undefined) {
    console.log(
      "Specify NOTARIZER_APPLE_ID and NOTARIZER_APPLE_ID_PASSWORD in environment."
    );
    exit(1);
  }
  const appPaths = await packager({
    dir: ".",
    out: "./dist",
    overwrite: true,
    icon: "./public/icon.icns",
    osxSign: {
      identity: "Developer ID Application: Christopher Swenson (FP9B5B6FCU)",
      hardenedRuntime: true,
      entitlements: "entitlements.plist",
      "entitlements-inherit": "entitlements.plist",
    },
    osxNotarize: {
      appleId,
      appleIdPassword,
    },
  });
  console.log(`Electron app bundles created:\n${appPaths.join("\n")}`);
}

packageDemo()
  .then(() => {
    console.log("Demo application built successfully");
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
