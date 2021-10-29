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
import * as malloy from "malloy";
import * as fs from "fs";
import * as util from "util";
import * as path from "path";
import { BigQueryConnection } from "malloy-db-bigquery";

export function run(
  files: malloy.UriReader,
  args: string[]
): Promise<malloy.QueryResult> {
  const connection = new BigQueryConnection("bigquery");
  const runtime = new malloy.Runtime(files, connection, connection);
  const { query, model } = getOptions(args);
  return model ? runtime.run(model, query) : runtime.run(query);
}

function getOptions(args: string[]) {
  let query: malloy.QueryUri | malloy.QueryString | undefined;
  let model: malloy.ModelUri | malloy.ModelString | undefined;
  while (args.length >= 2) {
    const [option, value] = args;
    args = args.slice(2);
    if (option === "--query") {
      query = value;
    } else if (option === "--query-file") {
      query = malloy.Uri.fromString("file://" + path.resolve(value));
    } else if (option === "--model") {
      model = value;
    } else if (option === "--model-file") {
      model = malloy.Uri.fromString("file://" + path.resolve(value));
    }
  }
  if (query === undefined) {
    throw new Error("--query or --query-file is required");
  }
  return { query, model };
}

export async function main(): Promise<void> {
  const files = {
    readUri: async (uri: malloy.Uri) => {
      const filePath = uri.toString().replace(/^file:\/\//, "");
      return await util.promisify(fs.readFile)(filePath, "utf8");
    },
  };
  console.log((await run(files, process.argv)).result);
}
