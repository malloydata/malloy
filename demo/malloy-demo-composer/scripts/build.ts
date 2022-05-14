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

import { build } from "esbuild";
import inlineImage from "esbuild-plugin-inline-image";
import svgrPlugin from "esbuild-plugin-svgr";

async function doBuild() {
  await build({
    entryPoints: ["./src/index.tsx"],
    outfile: "./public/js/app.js",
    minify: true,
    bundle: true,
    platform: "browser",
    loader: {
      ".js": "jsx",
    },
    plugins: [
      inlineImage({ extensions: ["png"] }),
      svgrPlugin({ exportType: "named" }),
    ],
    define: {
      "process.env.NODE_DEBUG": "false", // TODO this is a hack because some package we include assumed process.env exists :(
    },
    inject: ["./react-shim.js"], // This shim elimanites needing to have "require React from 'react'" in every file
  }).catch((e: any) => {
    console.log(e);
    process.exit(1);
  });
}

doBuild();
