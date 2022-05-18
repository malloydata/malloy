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

async function packageDemo() {
  const appPaths = await packager({
    dir: ".",
    out: "./dist",
    overwrite: true,
    icon: "./public/icon.icns",
  });
  console.log(`Electron app bundles created:\n${appPaths.join("\n")}`);

  // {
  //   dir: '/path/to/my/app',
  // osxSign: {
  //   identity: 'Developer ID Application: Felix Rieseberg (LT94ZKYDCJ)',
  //   'hardened-runtime': true,
  //   entitlements: 'entitlements.plist',
  //   'entitlements-inherit': 'entitlements.plist',
  //   'signature-flags': 'library'
  // },
  // osxNotarize: {
  //   appleId: 'felix@felix.fun',
  //   appleIdPassword: 'my-apple-id-password'
  // }
  // }
}

packageDemo()
  .then(() => {
    console.log("Demo application built successfully");
  })
  .catch((error) => {
    console.log(error);
    process.exit(1);
  });
