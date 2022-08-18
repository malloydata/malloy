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
/* eslint-disable no-console */

// collect dependencies

// collect transitive dependencies

// TODO handle workspaces node_modules and dependencies? can't just use the node_modules folder
// as that won't contain sub-dependencies

import fs from "fs";

export function readPackageJson(path: string): any {
  try {
    const fileBuffer = fs.readFileSync(path, "utf8");
    return JSON.parse(fileBuffer);
  } catch (error) {
    console.error("Could not read package.json", error);
    throw error;
  }
}

export function getDependencies(rootPackageJson: string): string[] {
  const rootPackage = readPackageJson(rootPackageJson);
  // eslint-disable-next-line no-prototype-builtins
  return rootPackage.hasOwnProperty("dependencies")
    ? Object.keys(rootPackage.dependencies)
    : [];
}
