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

import * as path from "path";
import { performance } from "perf_hooks";
import * as vscode from "vscode";
import { MALLOY_EXTENSION_STATE, RunState } from "../state";
import { Result } from "@malloydata/malloy";
import turtleIcon from "../../media/turtle.svg";
import { getWebviewHtml } from "../webviews";
import { QueryMessageType, QueryRunStatus } from "../message_types";
import { WebviewMessageManager } from "../webview_message_manager";
import { queryDownload } from "./query_download";
import { getWorker } from "../extension";
import { WorkerMessage } from "../../worker/types";

const malloyLog = vscode.window.createOutputChannel("Malloy");
interface NamedQuerySpec {
  type: "named";
  name: string;
  file: vscode.TextDocument;
}

interface QueryStringSpec {
  type: "string";
  text: string;
  file: vscode.TextDocument;
}

interface QueryFileSpec {
  type: "file";
  index: number;
  file: vscode.TextDocument;
}

interface NamedSQLQuerySpec {
  type: "named_sql";
  name: string;
  file: vscode.TextDocument;
}

interface UnnamedSQLQuerySpec {
  type: "unnamed_sql";
  index: number;
  file: vscode.TextDocument;
}

export type QuerySpec =
  | NamedQuerySpec
  | QueryStringSpec
  | QueryFileSpec
  | NamedSQLQuerySpec
  | UnnamedSQLQuerySpec;

export function runMalloyQuery(
  query: QuerySpec,
  panelId: string,
  name: string
): void {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Malloy Query (${name})`,
      cancellable: true,
    },
    (progress, token) => {
      const cancel = () => {
        worker.send({
          type: "cancel",
          panelId,
        });
        if (current) {
          const actuallyCurrent = MALLOY_EXTENSION_STATE.getRunState(
            current.panelId
          );
          if (actuallyCurrent === current) {
            current.panel.dispose();
            MALLOY_EXTENSION_STATE.setRunState(current.panelId, undefined);
            token.isCancellationRequested = true;
          }
        }
      };

      token.onCancellationRequested(cancel);

      const previous = MALLOY_EXTENSION_STATE.getRunState(panelId);

      let current: RunState;
      if (previous) {
        current = {
          cancel,
          panelId,
          panel: previous.panel,
          messages: previous.messages,
          document: previous.document,
        };
        MALLOY_EXTENSION_STATE.setRunState(panelId, current);
        previous.cancel();
        if (!previous.panel.visible) {
          previous.panel.reveal(vscode.ViewColumn.Beside, true);
        }
      } else {
        const panel = vscode.window.createWebviewPanel(
          "malloyQuery",
          name,
          { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
          { enableScripts: true, retainContextWhenHidden: true }
        );

        panel.onDidChangeViewState(
          (e: vscode.WebviewPanelOnDidChangeViewStateEvent) => {
            vscode.commands.executeCommand(
              "setContext",
              "malloy.webviewPanelFocused",
              e.webviewPanel.active
            );
          }
        );

        current = {
          panel,
          messages: new WebviewMessageManager(panel),
          panelId,
          cancel,
          document: query.file,
        };
        current.panel.iconPath = vscode.Uri.parse(
          path.join(__filename, "..", turtleIcon)
        );
        MALLOY_EXTENSION_STATE.setRunState(panelId, current);
      }

      const onDiskPath = vscode.Uri.file(
        path.join(__filename, "..", "query_page.js")
      );

      const entrySrc = current.panel.webview.asWebviewUri(onDiskPath);

      current.panel.webview.html = getWebviewHtml(
        entrySrc.toString(),
        current.panel.webview
      );

      current.panel.onDidDispose(() => {
        current.cancel();
      });

      MALLOY_EXTENSION_STATE.setActiveWebviewPanelId(current.panelId);
      current.panel.onDidChangeViewState((event) => {
        if (event.webviewPanel.active) {
          MALLOY_EXTENSION_STATE.setActiveWebviewPanelId(current.panelId);
          vscode.commands.executeCommand("malloy.refreshSchema");
        }
      });

      const { file, ...params } = query;
      const fsPath = file.uri.fsPath;
      const worker = getWorker();
      worker.send({
        type: "run",
        query: {
          file: fsPath,
          ...params,
        },
        panelId,
        name,
      });

      return new Promise((resolve) => {
        const listener = (msg: WorkerMessage) => {
          if (msg.type === "dead") {
            current.messages.postMessage({
              type: QueryMessageType.QueryStatus,
              status: QueryRunStatus.Error,
              error: "Worker died",
            });
            worker.off("message", listener);
            resolve(undefined);
            return;
          } else if (msg.type !== "query_panel") {
            return;
          }
          const { message, panelId: msgPanelId } = msg;
          if (msgPanelId !== panelId) {
            return;
          }
          current.messages.postMessage({
            ...message,
          });
          const allBegin = performance.now();
          const compileBegin = allBegin;
          let runBegin;

          switch (message.type) {
            case QueryMessageType.QueryStatus:
              switch (message.status) {
                case QueryRunStatus.Compiling:
                  {
                    progress.report({ increment: 20, message: "Compiling" });
                  }
                  break;
                case QueryRunStatus.Running:
                  {
                    const compileEnd = performance.now();
                    runBegin = compileEnd;
                    logTime("Compile", compileBegin, compileEnd);

                    progress.report({ increment: 40, message: "Running" });
                  }
                  break;
                case QueryRunStatus.Done:
                  {
                    const runEnd = performance.now();
                    if (runBegin != null) {
                      logTime("Run", runBegin, runEnd);
                    }
                    const { result } = message;
                    const queryResult = Result.fromJSON(result);
                    current.result = queryResult;
                    progress.report({ increment: 100, message: "Rendering" });
                    const allEnd = performance.now();
                    logTime("Total", allBegin, allEnd);

                    current.messages.onReceiveMessage((message) => {
                      if (message.type === QueryMessageType.StartDownload) {
                        queryDownload(
                          query,
                          message.downloadOptions,
                          queryResult,
                          panelId,
                          name
                        );
                      }
                    });

                    worker.off("message", listener);
                    resolve(undefined);
                  }
                  break;
                case QueryRunStatus.Error:
                  {
                    worker.off("message", listener);
                    resolve(undefined);
                  }
                  break;
              }
          }
        };

        worker.on("message", listener);
      });
    }
  );
}

function logTime(name: string, start: number, end: number) {
  malloyLog.appendLine(
    `${name} time: ${((end - start) / 1000).toLocaleString()}s`
  );
}
