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

import { ResultJSON } from "@malloydata/malloy";
import { DataStyles } from "@malloydata/render";
import { ConnectionConfig } from "../common";

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

interface QueryMessageStatusCompiling {
  type: QueryMessageType.QueryStatus;
  status: QueryRunStatus.Compiling;
}

interface QueryMessageStatusRunning {
  type: QueryMessageType.QueryStatus;
  status: QueryRunStatus.Running;
  sql: string;
}

interface QueryMessageStatusError {
  type: QueryMessageType.QueryStatus;
  status: QueryRunStatus.Error;
  error: string;
}

interface QueryMessageStatusDone {
  type: QueryMessageType.QueryStatus;
  status: QueryRunStatus.Done;
  result: ResultJSON;
  styles: DataStyles;
}

type QueryMessageStatus =
  | QueryMessageStatusCompiling
  | QueryMessageStatusError
  | QueryMessageStatusRunning
  | QueryMessageStatusDone;

interface QueryMessageAppReady {
  type: QueryMessageType.AppReady;
}

export interface QueryDownloadOptions {
  format: "json" | "csv";
  amount: "current" | "all" | number;
}

interface QueryMessageStartDownload {
  type: QueryMessageType.StartDownload;
  downloadOptions: QueryDownloadOptions;
}

export type QueryPanelMessage =
  | QueryMessageStatus
  | QueryMessageAppReady
  | QueryMessageStartDownload;

export enum ConnectionMessageType {
  SetConnections = "set-connections",
  AppReady = "app-ready",
  TestConnection = "test-connection",
  RequestBigQueryServiceAccountKeyFile = "request-bigquery-service-account-key-file",
}

interface ConnectionMessageSetConnections {
  type: ConnectionMessageType.SetConnections;
  connections: ConnectionConfig[];
}

interface ConnectionMessageAppReady {
  type: ConnectionMessageType.AppReady;
}

export enum ConnectionTestStatus {
  Waiting = "waiting",
  Success = "success",
  Error = "error",
}

interface ConnectionMessageTestConnectionWaiting {
  type: ConnectionMessageType.TestConnection;
  status: ConnectionTestStatus.Waiting;
  connection: ConnectionConfig;
}

interface ConnectionMessageTestConnectionSuccess {
  type: ConnectionMessageType.TestConnection;
  status: ConnectionTestStatus.Success;
  connection: ConnectionConfig;
}

interface ConnectionMessageTestConnectionError {
  type: ConnectionMessageType.TestConnection;
  status: ConnectionTestStatus.Error;
  error: string;
  connection: ConnectionConfig;
}

export type ConnectionMessageTest =
  | ConnectionMessageTestConnectionWaiting
  | ConnectionMessageTestConnectionSuccess
  | ConnectionMessageTestConnectionError;

export enum ConnectionServiceAccountKeyRequestStatus {
  Waiting = "waiting",
  Success = "success",
}

interface ConnectionMessageServiceAccountKeyRequestWaiting {
  type: ConnectionMessageType.RequestBigQueryServiceAccountKeyFile;
  status: ConnectionServiceAccountKeyRequestStatus.Waiting;
  connectionId: string;
}

interface ConnectionMessageServiceAccountKeyRequestSuccess {
  type: ConnectionMessageType.RequestBigQueryServiceAccountKeyFile;
  status: ConnectionServiceAccountKeyRequestStatus.Success;
  connectionId: string;
  serviceAccountKeyPath: string;
}

export type ConnectionMessageServiceAccountKeyRequest =
  | ConnectionMessageServiceAccountKeyRequestWaiting
  | ConnectionMessageServiceAccountKeyRequestSuccess;

export type ConnectionPanelMessage =
  | ConnectionMessageAppReady
  | ConnectionMessageSetConnections
  | ConnectionMessageTest
  | ConnectionMessageServiceAccountKeyRequest;

export enum HelpMessageType {
  AppReady = "app-ready",
  EditConnections = "edit-connections",
}

interface HelpMessageAppReady {
  type: HelpMessageType.AppReady;
}

interface HelpMessageEditConnections {
  type: HelpMessageType.EditConnections;
}

export type HelpPanelMessage = HelpMessageAppReady | HelpMessageEditConnections;
