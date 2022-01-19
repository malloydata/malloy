/*
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ResultJSON } from "@malloydata/malloy";
import { DataStyles } from "@malloydata/render";
import { WebviewPanel } from "vscode";

export class WebviewMessageManager<T> {
  constructor(private panel: WebviewPanel) {
    this.panel.webview.onDidReceiveMessage((message: T) => {
      if (!this.panelCanReceiveMessages) {
        this.onPanelCanReceiveMessages();
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
    this.flushPendingMessages();
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
