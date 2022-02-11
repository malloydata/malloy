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

module.exports = {
  globals: {
    "ts-jest": { tsconfig: "<rootDir>/tsconfig.json" },
  },
  moduleFileExtensions: ["js", "jsx", "ts", "tsx"],
  setupFilesAfterEnv: ["jest-expect-message"],
  testMatch: ["**/?(*.)spec.(ts|js)?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/out/"],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  testTimeout: 100000,
  verbose: true,
};
