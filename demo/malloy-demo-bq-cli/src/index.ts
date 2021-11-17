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
/* eslint-disable no-console */
import * as malloy from "@malloy-lang/malloy";
import { promises as fs } from "fs";
import * as path from "path";
import { BigQueryConnection } from "@malloy-lang/db-bigquery";

export function pathToURL(filePath: string): malloy.URL {
  return malloy.URL.fromString("file://" + path.resolve(filePath));
}

export function run(
  files: malloy.URLReader,
  args: string[]
): Promise<malloy.Result> {
  const connection = new BigQueryConnection("bigquery");
  const runtime = new malloy.Runtime(files, connection);
  const { query, model } = getOptions(args);
  const queryMaterializer = model
    ? runtime.loadModel(model).loadQuery(query)
    : runtime.loadQuery(query);
  return queryMaterializer.run();
}

function getOptions(args: string[]) {
  let query: malloy.QueryURL | malloy.QueryString | undefined;
  let model: malloy.ModelURL | malloy.ModelString | undefined;
  while (args.length >= 2) {
    const [option, value] = args;
    args = args.slice(2);
    if (option === "--query") {
      query = value;
    } else if (option === "--query-file") {
      query = malloy.URL.fromString("file://" + path.resolve(value));
    } else if (option === "--model") {
      model = value;
    } else if (option === "--model-file") {
      model = malloy.URL.fromString("file://" + path.resolve(value));
    }
  }
  if (query === undefined) {
    throw new Error("--query or --query-file is required");
  }
  return { query, model };
}

export async function main(): Promise<void> {
  const files = {
    readURL: async (url: malloy.URL) => {
      const filePath = url.toString().replace(/^file:\/\//, "");
      return fs.readFile(filePath, "utf8");
    },
  };
  console.log((await run(files, process.argv)).getData().toObject());
}
