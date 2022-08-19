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

import path from "path";
import { readPackageJson } from "./utils/licenses";
import fs from "fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
let filePath: string;
const seen: { [id: string]: boolean } = {};

/*
 * Required components:
 * * The name of the component
 * * Identification of the component's license(s)
 * * The complete text of every unique license (at least once)
 * * The contents of any NOTICE file included with the component (if it includes one)
 */
export function generateDisclaimer(
  packageJsonPath: string,
  nodeModulesPath: string,
  disclaimerPath: string
): void {
  filePath = disclaimerPath;
  const rootPackageJson = readPackageJson(packageJsonPath);

  if (fs.existsSync(filePath)) {
    throw new Error(`${filePath} already exists`);
  }

  doDependencies(nodeModulesPath, rootPackageJson);
}

function doDependencies(nodeModulesPath: string, packageJson: any): void {
  // eslint-disable-next-line no-prototype-builtins
  if (packageJson.hasOwnProperty("dependencies")) {
    const dependencies = packageJson.dependencies;

    for (const dependency of Object.keys(dependencies)) {
      if (seen[dependency] == true || !(typeof dependency == "string")) {
        continue;
      }

      const pkg = readPackageJson(
        path.join(nodeModulesPath, dependency, "package.json")
      );

      // look for notice & license text
      let notice: string | undefined = undefined;
      let license: string | undefined = undefined;
      const packageFiles = fs.readdirSync(
        path.join(nodeModulesPath, dependency)
      );
      packageFiles.find((fileName) => {
        const base = fileName.split(".")[0].toLowerCase();

        if (base == "notice" || base == "notices") {
          notice = fs.readFileSync(
            path.join(nodeModulesPath, dependency, fileName),
            "utf-8"
          );
        }

        if (base == "license" || base == "licenses") {
          license = fs.readFileSync(
            path.join(nodeModulesPath, dependency, fileName),
            "utf-8"
          );
        }
      });

      if (license == undefined && pkg.license == undefined) {
        throw new Error(
          `${dependency}: license type undefined in package.json and license file cannot be found`
        );
      }

      const licenseType = pkg.license ? pkg.license : "see license text below";

      const url = [
        pkg.homepage,
        pkg.repository?.url,
        pkg.repository?.baseUrl,
        pkg.repo,
        `https://npmjs.com/package/${dependency}`,
      ].find((el) => el !== undefined);

      fs.appendFileSync(
        filePath,
        `
-------
Package: ${dependency}
Url: ${url}
License(s): ${licenseType}
${license ? "License Text:\n" + license + "\n" : ""}
${notice ? "\nNotice:\n" + notice + "\n" : ""}
        `
      );

      seen[dependency] = true;
      doDependencies(nodeModulesPath, pkg);
    }
  }
}
