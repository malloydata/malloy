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

import { ModelDef } from "@malloydata/malloy";
import { CONCAT, ROUND, STDDEV, CUSTOM_AVG } from "./functions";
import {
  arg,
  func,
  maxAnalytic,
  maxScalar,
  minAggregate,
  overload,
  param,
  sql
} from "./util";

export const SILLY = func(
  "silly",
  overload(
    minAggregate("number"),
    [
      param("value1", maxScalar("number")),
      param("value", maxAnalytic("number"))
    ],
    [sql("SUM(", arg("value1"), ") + ", arg("value"))]
  )
);

const funcs = [CONCAT, STDDEV, ROUND, CUSTOM_AVG, SILLY];

export const BIGQUERY_FUNCTIONS: ModelDef = {
  "contents": Object.fromEntries(funcs.map((f) => [f.name, f])),
  "exports": funcs.map((f) => f.name),
  "name": "malloy-lib-bigquery-functions"
};

export function resolve(url: URL): string {
  if (url.toString() === "malloy://bigquery_functions") {
    return JSON.stringify(BIGQUERY_FUNCTIONS);
  }
  throw new Error(`No such file '${url}' in malloy standard library.`);
}
