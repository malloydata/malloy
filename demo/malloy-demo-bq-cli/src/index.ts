/* eslint-disable no-console */
import * as malloy from "malloy";
import * as fs from "fs";
import * as util from "util";
import * as path from "path";
import { BigQueryConnection } from "malloy-db-bigquery";
import { QueryResult } from "malloy";

export function run(
  files: malloy.UriFetcher,
  args: string[]
): Promise<QueryResult> {
  const connection = new BigQueryConnection("bigquery");
  const runtime = new malloy.Runtime(files, connection, connection);
  const { query, model } = getOptions(args);
  return runtime.executeQuery(query, model);
}

function getOptions(args: string[]) {
  let query: malloy.QuerySpecification | undefined;
  let model: malloy.ModelSpecification | undefined;
  while (args.length >= 2) {
    const [option, value] = args;
    args = args.slice(2);
    if (option === "--query") {
      query = { string: value };
    } else if (option === "--query-file") {
      query = { uri: "file://" + path.resolve(value) };
    } else if (option === "--model") {
      model = { string: value };
    } else if (option === "--model-file") {
      model = { uri: "file://" + path.resolve(value) };
    }
  }
  if (query === undefined) {
    throw new Error("--query or --query-file is required");
  }
  return { query, model };
}

export async function main(): Promise<void> {
  const files = {
    fetchUriContents: async (uri: string) => {
      uri = uri.replace(/^file:\/\//, "");
      return await util.promisify(fs.readFile)(uri, "utf8");
    },
  };
  console.log((await run(files, process.argv)).result);
}
