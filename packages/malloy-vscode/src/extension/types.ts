import { QueryResult } from "malloy";

export enum QueryRunStatus {
  Compiling = "compiling",
  Running = "running",
  Error = "error",
  Done = "done",
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
  sizeTest: string[];
  time: string;
}

type QueryMessageStatus =
  | QueryMessageStatusCompiling
  | QueryMessageStatusError
  | QueryMessageStatusRunning
  | QueryMessageStatusDone;

export type QueryPanelMessage = QueryMessageStatus;
