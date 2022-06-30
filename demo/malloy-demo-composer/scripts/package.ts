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
import { doBuild } from "./build";

async function packageDemo(platform: string, architecture: string) {
  doBuild(`${platform}-${architecture}`);
  const appleId = process.env.NOTARIZER_APPLE_ID;
  const appleIdPassword = process.env.NOTARIZER_APPLE_ID_PASSWORD;
  const signerIdentity = process.env.SIGNER_IDENTITY;
  const shouldSignAndNotarize = process.env.DISABLE_SIGNING === undefined;
  if (
    appleId === undefined ||
    appleIdPassword === undefined ||
    signerIdentity == undefined
  ) {
    console.log(
      "Specify NOTARIZER_APPLE_ID, NOTARIZER_APPLE_ID_PASSWORD, and SIGNER_IDENTITY in environment."
    );
    exit(1);
  }
  const appPaths = await packager({
    dir: ".",
    out: "./dist",
    overwrite: true,
    icon: "./public/icon.icns",
    osxSign: shouldSignAndNotarize
      ? {
          identity: signerIdentity,
          hardenedRuntime: true,
          entitlements: "entitlements.plist",
          "entitlements-inherit": "entitlements.plist",
        }
      : undefined,
    osxNotarize: shouldSignAndNotarize
      ? {
          appleId,
          appleIdPassword,
        }
      : undefined,
    ignore: [
      /node_modules/,
      /env/,
      /src/,
      /scripts/,
      /composer_config\.sample\.json/,
    ],
    platform,
    arch: architecture,
    extraResource: ["../../samples/"],
  });
  console.log(`Electron app bundles created:\n${appPaths.join("\n")}`);
}

(async () => {
  const platform = process.argv[2];
  const architecture = process.argv[3];
  if (platform === undefined || architecture === undefined) {
    throw new Error("Specify platform and architecture.");
  }
  await packageDemo(platform, architecture);
})()
  .then(() => {
    console.log("Demo application built successfully");
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
