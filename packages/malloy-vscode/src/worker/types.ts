import {
  QueryDownloadOptions,
  QueryPanelMessage,
} from "../extension/message_types";

interface NamedQuerySpec {
  type: "named";
  name: string;
  file: string;
}

interface QueryStringSpec {
  type: "string";
  text: string;
  file: string;
}

interface QueryFileSpec {
  type: "file";
  index: number;
  file: string;
}

interface NamedSQLQuerySpec {
  type: "named_sql";
  name: string;
  file: string;
}

interface UnnamedSQLQuerySpec {
  type: "unnamed_sql";
  index: number;
  file: string;
}

export type WorkerQuerySpec =
  | NamedQuerySpec
  | QueryStringSpec
  | QueryFileSpec
  | NamedSQLQuerySpec
  | UnnamedSQLQuerySpec;

/*
 * Incoming messages
 */

export interface MessageExit {
  type: "exit";
}

export interface MessageRun {
  type: "run";
  query: WorkerQuerySpec;
  panelId: string;
  name: string;
}

export interface MessageCancel {
  type: "cancel";
  panelId: string;
}

export interface MessageDownload {
  type: "download";
  query: WorkerQuerySpec;
  panelId: string;
  name: string;
  filePath: string;
  downloadOptions: QueryDownloadOptions;
}

export type Message =
  | MessageCancel
  | MessageExit
  | MessageRun
  | MessageDownload;

/**
 * Outgoing messages
 */

export interface WorkerDownloadMessage {
  type: "download";
  name: string;
  error?: string;
}

export interface WorkerLogMessage {
  type: "log";
  message: string;
}

export interface WorkerQueryPanelMessage {
  type: "query_panel";
  panelId: string;
  message: QueryPanelMessage;
}

export interface WorkerStartMessage {
  type: "start";
}

export type WorkerMessage =
  | WorkerDownloadMessage
  | WorkerLogMessage
  | WorkerQueryPanelMessage
  | WorkerStartMessage;
