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

import { ResultJSON } from "@malloydata/malloy";
import { DataStyles } from "@malloydata/render";
import { WebviewPanel } from "vscode";
import { ConnectionConfig } from "../common";

export class WebviewMessageManager<T> {
  constructor(private panel: WebviewPanel) {
    this.panel.webview.onDidReceiveMessage((message: T) => {
      if (!this.clientCanReceiveMessages) {
        this.onClientCanReceiveMessages();
      }
      this.callback(message);
    });
    this.panel.onDidChangeViewState(() => {
      if (this.panelCanReceiveMessages && !this.panel.visible) {
        this.panelCanReceiveMessages = false;
      } else if (!this.panelCanReceiveMessages && this.panel.visible) {
        this.onPanelCanReceiveMessages();
      }
    });
  }

  private pendingMessages: T[] = [];
  private panelCanReceiveMessages = false;
  private clientCanReceiveMessages = false;
  private callback: (message: T) => void = () => {
    /* Do nothing by default */
  };

  public postMessage(message: T): void {
    if (this.panelCanReceiveMessages) {
      this.panel.webview.postMessage(message);
    } else {
      this.pendingMessages.push(message);
    }
  }

  public onReceiveMessage(callback: (message: T) => void): void {
    this.callback = callback;
  }

  private flushPendingMessages() {
    this.pendingMessages.forEach((message) => {
      this.panel.webview.postMessage(message);
    });
    this.pendingMessages.splice(0, this.pendingMessages.length);
  }

  private onPanelCanReceiveMessages() {
    this.panelCanReceiveMessages = true;
    if (this.canSendMessages) {
      this.flushPendingMessages();
    }
  }

  private onClientCanReceiveMessages() {
    this.clientCanReceiveMessages = true;
    if (this.canSendMessages) {
      this.flushPendingMessages();
    }
  }

  private get canSendMessages() {
    return this.panelCanReceiveMessages && this.clientCanReceiveMessages;
  }
}

export enum QueryRunStatus {
  Compiling = "compiling",
  Running = "running",
  Error = "error",
  Done = "done",
}

export enum QueryMessageType {
  QueryStatus = "query-status",
  AppReady = "app-ready",
}

export enum QueryRenderMode {
  HTML = "html",
  JSON = "json",
}

interface QueryMessageStatusCompiling {
  type: QueryMessageType.QueryStatus;
  status: QueryRunStatus.Compiling;
}

interface QueryMessageStatusRunning {
  type: QueryMessageType.QueryStatus;
  status: QueryRunStatus.Running;
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
  mode: QueryRenderMode;
}

type QueryMessageStatus =
  | QueryMessageStatusCompiling
  | QueryMessageStatusError
  | QueryMessageStatusRunning
  | QueryMessageStatusDone;

interface QueryMessageAppReady {
  type: QueryMessageType.AppReady;
}

export type QueryPanelMessage = QueryMessageStatus | QueryMessageAppReady;

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
