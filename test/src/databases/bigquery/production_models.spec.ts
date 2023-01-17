/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import fs from "fs";
import path from "path";
import { Runtime } from "@malloydata/malloy";
import { BigQueryConnection } from "@malloydata/db-bigquery";
import { describeIfDatabaseAvailable } from "../../util";

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
