import {
  QueryMaterializer,
  Runtime,
  SQLBlockMaterializer,
} from "@malloydata/malloy";
import { WorkerQuerySpec } from "./types";

export const createRunnable = (
  query: WorkerQuerySpec,
  runtime: Runtime
): SQLBlockMaterializer | QueryMaterializer => {
  let runnable: QueryMaterializer | SQLBlockMaterializer;
  const queryFileURL = new URL("file://" + query.file);
  if (query.type === "string") {
    runnable = runtime.loadModel(queryFileURL).loadQuery(query.text);
  } else if (query.type === "named") {
    runnable = runtime.loadQueryByName(queryFileURL, query.name);
  } else if (query.type === "file") {
    if (query.index === -1) {
      runnable = runtime.loadQuery(queryFileURL);
    } else {
      runnable = runtime.loadQueryByIndex(queryFileURL, query.index);
    }
  } else if (query.type === "named_sql") {
    runnable = runtime.loadSQLBlockByName(queryFileURL, query.name);
  } else if (query.type === "unnamed_sql") {
    runnable = runtime.loadSQLBlockByIndex(queryFileURL, query.index);
  } else {
    throw new Error("Internal Error: Unexpected query type");
  }
  return runnable;
};
