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

import path from "path";
import fs from "fs-extra";

const __dirname = path.resolve("./docs/_scripts/build_docs");

const FIDDLE_IN_PATH = path.join(
  __dirname,
  "../../../demo/malloy-duckdb-wasm/docs"
);
const FIDDLE_OUT_PATH = path.join(__dirname, "../../fiddle");
const FIDDLE_INDEX_FILE = path.join(FIDDLE_OUT_PATH, "index.html");

const HEADER = `---
layout: fiddle
---
`;

export async function copyFiddle(): Promise<void> {
  await fs.rm(FIDDLE_OUT_PATH, { recursive: true, force: true });
  await fs.copy(FIDDLE_IN_PATH, FIDDLE_OUT_PATH);

  const index = fs.readFileSync(FIDDLE_INDEX_FILE, "utf-8");
  const indexTemplate =
    HEADER + index.replace(/<\/head>/g, `{% include ga.html %}\n  </head>`);
  fs.writeFileSync(FIDDLE_INDEX_FILE, indexTemplate);
}
