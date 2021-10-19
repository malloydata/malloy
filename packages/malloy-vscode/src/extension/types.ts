import { QueryResult } from "malloy";
import { DataStyles } from "malloy-render";

export enum QueryRunStatus {
  Compiling = "compiling",
  Running = "running",
  Error = "error",
  Done = "done",
  Rendering = "rendering",
}

interface QueryMessageStatusCompiling {
  type: "query-status";
  status: QueryRunStatus.Compiling;
}

interface QueryMessageStatusRunning {
  type: "query-status";
  status: QueryRunStatus.Running;
}

interface QueryMessageStatusError {
  type: "query-status";
  status: QueryRunStatus.Error;
  error: string;
}

interface QueryMessageStatusDone {
  type: "query-status";
  status: QueryRunStatus.Done;
  result: QueryResult;
  styles: DataStyles;
}

type QueryMessageStatus =
  | QueryMessageStatusCompiling
  | QueryMessageStatusError
  | QueryMessageStatusRunning
  | QueryMessageStatusDone;

interface QueryMessageShowJSON {
  type: "show_json";
}

interface QueryMessageDrill {
  type: "drill";
  query: string;
}

export type QueryPanelMessage =
  | QueryMessageStatus
  | QueryMessageShowJSON
  | QueryMessageDrill;
