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

/*
 * Required components:
 * * The name of the component
 * * Identification of the component's license(s)
 * * The complete text of every unique license (at least once)
 * * The contents of any NOTICE file included with the component (if it includes one)
 */
interface ModuleInfo {
  name: string;
  licenseType: string;
  url?: string;
  licenseText: string;
  noticeText?: string;
}

let filePath: string;
const seen: { [id: string]: boolean } = {};

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

    // TODO optional dependencies

    for (const dependency of Object.keys(dependencies)) {
      if (seen[dependency] == true || !(typeof dependency == "string")) {
        continue;
      }

      const pkg = readPackageJson(
        path.join(nodeModulesPath, dependency, "package.json")
      );
      const name = dependency;
      const licenseType = pkg.license;
      // TODO if this isn't set, do some work to find a license file

      const url = [
        pkg.homepage,
        pkg.repository?.url,
        pkg.repository?.baseUrl,
        pkg.repo,
      ].find((el) => el !== undefined);

      const moduleInfo: ModuleInfo = {
        name,
        licenseType,
        url,
        licenseText: "",
      };

      fs.appendFileSync(filePath, `${licenseType}\t${name}\n`);

      seen[name] = true;
      doDependencies(nodeModulesPath, pkg);
    }
  }
}

generateDisclaimer(
  path.join(__dirname, "..", "packages", "malloy-vscode", "package.json"),
  path.join(__dirname, "..", "node_modules"),
  path.join(__dirname, "..", "test!")
);
