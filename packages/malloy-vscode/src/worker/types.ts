/*
 * Copyright 2022 Google LLC
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

import {
  QueryDownloadOptions,
  QueryPanelMessage,
} from "../extension/message_types";
import { MalloyConfig } from "../extension/types";

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

export interface MessageConfig {
  type: "config";
  config: MalloyConfig;
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
  | MessageConfig
  | MessageExit
  | MessageRun
  | MessageDownload;

/**
 * Outgoing messages
 */

export interface WorkerDeadMessage {
  type: "dead";
}

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
  | WorkerDeadMessage
  | WorkerDownloadMessage
  | WorkerLogMessage
  | WorkerQueryPanelMessage
  | WorkerStartMessage;
