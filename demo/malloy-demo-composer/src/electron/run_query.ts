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

import { Result } from "@malloydata/malloy";
import { Analysis } from "../types";
import { RUNTIME } from "./runtime";

export async function runQuery(
  query: string,
  queryName: string,
  analysis: Analysis
): Promise<Result> {
  const runnable = RUNTIME.loadModel(
    analysis.malloy + "\n" + query
  ).loadQueryByName(queryName);
  const rowLimit = (await runnable.getPreparedResult()).resultExplore.limit;
  return runnable.run({ rowLimit });
}
