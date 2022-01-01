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

import "./jestery";
import fs from "fs";
import path from "path";
import { Malloy } from "../malloy";
import { MalloyTranslator, TranslateResponse } from "./parse-malloy";

const SAMPLE_PROJECT_ROOT = path.join(__dirname, "../../../../samples");

describe(`compiling server models`, () => {
  let modelsFound = false;
  for (const dir of fs.readdirSync(SAMPLE_PROJECT_ROOT)) {
    const projectPath = path.join(SAMPLE_PROJECT_ROOT, dir);
    if (!fs.statSync(projectPath).isDirectory()) continue;
    for (const fn of fs.readdirSync(projectPath)) {
      if (fn.endsWith("_beta.malloy")) {
        modelsFound = true;
        const filePath = path.join(projectPath, fn);
        const srcURI = `model://${filePath}`;
        test(`checking ${srcURI}`, async () => {
          const src = {
            URLs: { [srcURI]: fs.readFileSync(filePath, "utf-8") },
          };
          const trans = new MalloyTranslator(srcURI, src);
          expect(trans).toBeValidMalloy();
          let tr: TranslateResponse;
          do {
            tr = trans.translate();
            if (tr.tables) {
              const tables = await Malloy.db.getSchemaForMissingTables(
                tr.tables
              );
              trans.update({ tables });
            } else if (tr.URLs) {
              const files: { [fileName: string]: string } = {};
              for (const neededFile of tr.URLs) {
                files[neededFile] = fs.readFileSync(
                  neededFile.replace("model://", ""),
                  "utf-8"
                );
              }
              trans.update({ URLs: files });
            } else {
              expect(trans).toBeErrorless();
              expect(tr).toHaveProperty("translated");
            }
          } while (!tr.translated);
        });
      }
    }
  }
  expect(modelsFound).toBeTruthy();
});
