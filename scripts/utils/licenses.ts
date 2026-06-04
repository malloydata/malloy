/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import fs from 'fs';

export interface Package {
  license?: string;
  dependencies: Record<string, string>;
  homepage?: string;
  repository?: {
    url?: string;
    baseUrl?: string;
  };
  repo?: string;
}

export function readPackageJson(path: string): Package {
  try {
    const fileBuffer = fs.readFileSync(path, 'utf8');
    return JSON.parse(fileBuffer);
  } catch (error) {
    console.error('Could not read package.json', error);
    throw error;
  }
}

export function getDependencies(rootPackageJson: string): string[] {
  const rootPackage = readPackageJson(rootPackageJson);
  // eslint-disable-next-line no-prototype-builtins
  return rootPackage.hasOwnProperty('dependencies')
    ? Object.keys(rootPackage.dependencies)
    : [];
}
