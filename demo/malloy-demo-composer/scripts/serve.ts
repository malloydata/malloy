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
/* eslint-disable @typescript-eslint/no-explicit-any */

import { serve } from "esbuild";
import { commonConfig } from "./build";

async function doServe() {
  await serve(
    {
      servedir: "public",
      port: 3000,
    },
    commonConfig(true)
  ).catch((e: any) => {
    console.log(e);
    process.exit(1);
  });
}

doServe();
