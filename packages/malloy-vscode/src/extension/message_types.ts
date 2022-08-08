export enum QueryRunStatus {
  Compiling = "compiling",
  Running = "running",
  Error = "error",
  Done = "done",
}

export enum QueryMessageType {
  QueryStatus = "query-status",
  AppReady = "app-ready",
  StartDownload = "start-download",
}
