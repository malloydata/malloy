"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const malloy_1 = require("@malloydata/malloy");
const db_bigquery_1 = require("@malloydata/db-bigquery");
const SAMPLE_PROJECT_ROOT = path_1.default.join(__dirname, "../../../samples/bigquery");
describe(`compiling server models`, () => {
    let modelsFound = false;
    for (const dir of fs_1.default.readdirSync(SAMPLE_PROJECT_ROOT)) {
        const projectPath = path_1.default.join(SAMPLE_PROJECT_ROOT, dir);
        if (!fs_1.default.statSync(projectPath).isDirectory())
            continue;
        for (const fn of fs_1.default.readdirSync(projectPath)) {
            if (fn.endsWith(".malloy")) {
                modelsFound = true;
                const filePath = path_1.default.join(projectPath, fn);
                const srcURL = new URL(`model://${filePath}`);
                const fileReader = {
                    readURL: (url) => {
                        return Promise.resolve(fs_1.default.readFileSync(url.toString().replace("model://", ""), "utf-8"));
                    },
                };
                const runtime = new malloy_1.Runtime(fileReader, new db_bigquery_1.BigQueryConnection("bigquery"));
                test(`checking ${dir}/${fn}`, async () => {
                    await runtime.getModel(srcURL);
                });
            }
        }
    }
    expect(modelsFound).toBeTruthy();
});
//# sourceMappingURL=production_models.spec.js.map