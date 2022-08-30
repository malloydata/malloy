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

import fs from "fs";
import path from "path";
import { Runtime } from "@malloydata/malloy";
import { BigQueryConnection } from "@malloydata/db-bigquery";
import { describeIfDatabaseAvailable } from "../../test_utils";

const SAMPLE_PROJECT_ROOT = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "samples",
  "bigquery"
);

const [describe] = describeIfDatabaseAvailable(["bigquery"]);

describe(`compiling BigQuery sample models`, () => {
  let modelsFound = false;
  for (const dir of fs.readdirSync(SAMPLE_PROJECT_ROOT)) {
    const projectPath = path.join(SAMPLE_PROJECT_ROOT, dir);
    if (!fs.statSync(projectPath).isDirectory()) continue;
    for (const fn of fs.readdirSync(projectPath)) {
      if (fn.endsWith(".malloy")) {
        modelsFound = true;
        const filePath = path.join(projectPath, fn);
        const srcURL = new URL(`model://${filePath}`);
        const fileReader = {
          readURL: (url: URL) => {
            return Promise.resolve(
              fs.readFileSync(url.toString().replace("model://", ""), "utf-8")
            );
          },
        };
        const runtime = new Runtime(
          fileReader,
          new BigQueryConnection("bigquery")
        );
        test(`checking ${dir}/${fn}`, async () => {
          await runtime.getModel(srcURL);
        });
      }
    }
  }
  expect(modelsFound).toBeTruthy();
});
