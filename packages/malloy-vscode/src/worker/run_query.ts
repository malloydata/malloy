import {
  QueryMaterializer,
  Runtime,
  SQLBlockMaterializer,
} from "@malloydata/malloy";
import { DataStyles } from "@malloydata/render";

import { HackyDataStylesAccumulator } from "./data_styles";
import { WorkerURLReader } from "./files";
import { log } from "./logger";
import { WorkerQuerySpec } from "./types";

import { CONNECTION_MANAGER } from "../server/connections";
import {
  QueryMessageType,
  QueryPanelMessage,
  QueryRunStatus,
  WorkerQueryPanelMessage,
} from "../extension/message_types";

interface QueryEntry {
  panelId: string;
  canceled: boolean;
}

const runningQueries: Record<string, QueryEntry> = {};

const sendMessage = (message: QueryPanelMessage, panelId: string) => {
  const msg: WorkerQueryPanelMessage = {
    panelId,
    message,
  };
  log(`Sending: ${JSON.stringify(msg)}`);
  process.send?.(msg);
};

export const run_query = async (
  query: WorkerQuerySpec,
  panelId: string
): Promise<void> => {
  const reader = new WorkerURLReader();
  const files = new HackyDataStylesAccumulator(reader);
  const url = new URL(panelId);

  try {
    const runtime = new Runtime(
      files,
      CONNECTION_MANAGER.getConnectionLookup(url)
    );

    runningQueries[panelId] = { panelId, canceled: false };
    sendMessage(
      {
        type: QueryMessageType.QueryStatus,
        status: QueryRunStatus.Compiling,
      },
      panelId
    );

    let runnable: QueryMaterializer | SQLBlockMaterializer;
    let styles: DataStyles = {};
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

    // Set the row limit to the limit provided in the final stage of the query, if present
    const rowLimit =
      runnable instanceof QueryMaterializer
        ? (await runnable.getPreparedResult()).resultExplore.limit
        : undefined;

    try {
      const sql = await runnable.getSQL();
      styles = { ...styles, ...files.getHackyAccumulatedDataStyles() };

      if (runningQueries[panelId].canceled) return;
      log(sql);
    } catch (error) {
      sendMessage(
        {
          type: QueryMessageType.QueryStatus,
          status: QueryRunStatus.Error,
          error: error.message || "Something went wrong",
        },
        panelId
      );
      return;
    }

    sendMessage(
      {
        type: QueryMessageType.QueryStatus,
        status: QueryRunStatus.Running,
      },
      panelId
    );
    const queryResult = await runnable.run({ rowLimit });
    if (runningQueries[panelId].canceled) return;

    sendMessage(
      {
        type: QueryMessageType.QueryStatus,
        status: QueryRunStatus.Done,
        result: queryResult.toJSON(),
        styles,
      },
      panelId
    );
    delete runningQueries[panelId];
  } catch (error) {
    sendMessage(
      {
        type: QueryMessageType.QueryStatus,
        status: QueryRunStatus.Error,
        error: error.message,
      },
      panelId
    );
    delete runningQueries[panelId];
  }
};

export const cancel_query = (panelId: string): void => {
  if (runningQueries[panelId]) {
    runningQueries[panelId].canceled = true;
  }
};
