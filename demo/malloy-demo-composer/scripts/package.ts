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
import fs from "fs";
import packager from "electron-packager";
import { exit } from "process";
import { doBuild } from "./build";
import * as path from "path";
import { exec } from "child_process";

const outDir = "./dist";
const thirdPartyNotices = "third_party_notices.txt";

async function packageDemo(
  platform: string,
  architecture: string,
  signAndNotarize = true
) {
  doBuild(`${platform}-${architecture}`);

  // third_party_licenses.txt
  const licenseFilePath = path.join(outDir, thirdPartyNotices);
  fs.mkdirSync(outDir, { recursive: true });
  await new Promise((resolve, reject) => {
    const licenseFile = fs.createWriteStream(licenseFilePath);
    licenseFile.on("open", () => {
      exec("yarn licenses generate-disclaimer --prod", (error, stdio) => {
        if (error) {
          return reject(error);
        }
        licenseFile.write(stdio);
        licenseFile.close();
        resolve(licenseFile);
      });
    });
    licenseFile.on("error", (err) => {
      reject(err);
    });
  });

  const extraOptions: Partial<packager.Options> = {};
  if (signAndNotarize) {
    if (platform === "darwin") {
      const appleId = process.env.NOTARIZER_APPLE_ID;
      const appleIdPassword = process.env.NOTARIZER_APPLE_ID_PASSWORD;
      const signerIdentity = process.env.SIGNER_IDENTITY;
      const shouldSignAndNotarize = false;
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
      extraOptions.osxSign = shouldSignAndNotarize
        ? {
            identity: signerIdentity,
            hardenedRuntime: true,
            entitlements: "entitlements.plist",
            "entitlements-inherit": "entitlements.plist",
          }
        : undefined;
      extraOptions.osxNotarize = shouldSignAndNotarize
        ? {
            appleId,
            appleIdPassword,
          }
        : undefined;
    }
  }

  const appPaths = await packager({
    dir: ".",
    out: outDir,
    overwrite: true,
    icon: "./public/icon.icns",

    ignore: [
      /node_modules/,
      /env/,
      /src/,
      /scripts/,
      /composer_config\.sample\.json/,
    ],
    platform,
    arch: architecture,
    extraResource: ["../../samples/", path.join(outDir, thirdPartyNotices)],
    ...extraOptions,
  });
  console.log(`Electron app bundles created:\n${appPaths.join("\n")}`);
}

(async () => {
  const platform = process.argv[2];
  const architecture = process.argv[3];
  const signAndNotarize = process.argv[4];

  if (platform === undefined || architecture === undefined) {
    throw new Error("Specify platform and architecture.");
  }

  await packageDemo(
    platform,
    architecture,
    signAndNotarize == "false" ? false : true
  );
})()
  .then(() => {
    console.log("Demo application built successfully");
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
