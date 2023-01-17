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

import path from "path";
import fs from "fs-extra";

const __dirname = path.resolve("./docs/_scripts/build_docs");

const FIDDLE_OUT_PATH = path.join(__dirname, "../../fiddle");
const FIDDLE_INDEX_FILE = path.join(FIDDLE_OUT_PATH, "index.html");

const HEADER = `---
layout: fiddle
---
`;

export async function copyFiddle(): Promise<void> {
  if (process.env.MALLOY_FIDDLE_PATH) {
    await fs.rm(FIDDLE_OUT_PATH, { recursive: true, force: true });
    await fs.copy(process.env.MALLOY_FIDDLE_PATH, FIDDLE_OUT_PATH);

    const index = fs.readFileSync(FIDDLE_INDEX_FILE, "utf-8");
    const indexTemplate =
      HEADER + index.replace(/<\/head>/g, `{% include ga.html %}\n  </head>`);
    fs.writeFileSync(FIDDLE_INDEX_FILE, indexTemplate);
  }
}
