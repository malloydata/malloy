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
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import fs from "fs";

// https://github.com/evanw/esbuild/issues/1685#issuecomment-944916409
export const noNodeModulesSourceMaps = {
  name: "excludeVendorFromSourceMap",
  setup(build: any): void {
    build.onLoad({ filter: /node_modules/ }, (args: any) => {
      if (args.path.endsWith(".js")) {
        return {
          contents:
            fs.readFileSync(args.path, "utf8") +
            "\n//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIiJdLCJtYXBwaW5ncyI6IkEifQ==",
          loader: "default",
        };
      }
    });
  },
};
