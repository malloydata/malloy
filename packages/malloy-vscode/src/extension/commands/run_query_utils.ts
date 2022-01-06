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

import * as path from "path";
import { performance } from "perf_hooks";
import * as vscode from "vscode";
import { URL, Runtime, URLReader } from "@malloy-lang/malloy";
import { DataStyles } from "@malloy-lang/render";
import { renderErrorHTML } from "../html";
import { CONNECTION_MAP, MALLOY_EXTENSION_STATE, RunState } from "../state";
import turtleIcon from "../../media/turtle.svg";
import { fetchFile, VSCodeURLReader } from "../utils";
import { getWebviewHtml } from "../webviews";
import {
  QueryMessageType,
  QueryRenderMode,
  QueryRunStatus,
  WebviewMessageManager,
} from "../webview_message_manager";

const malloyLog = vscode.window.createOutputChannel("Malloy");

// TODO replace this with actual JSON metadata import functionality, when it exists
export async function dataStylesForFile(
  uri: string,
  text: string
): Promise<DataStyles> {
  const PREFIX = "--! styles ";
  let styles: DataStyles = {};
  for (const line of text.split("\n")) {
    if (line.startsWith(PREFIX)) {
      const fileName = line.trimEnd().substring(PREFIX.length);
      const stylesPath = path.join(
        uri.replace(/^file:\/\//, ""),
        "..",
        fileName
      );
      // TODO instead of failing silently when the file does not exist, perform this after the WebView has been
      //      created, so that the error can be shown there.
      let stylesText;
      try {
        stylesText = await fetchFile(stylesPath);
      } catch (error) {
        malloyLog.appendLine(
          `Error loading data style '${fileName}': ${error}`
        );
        stylesText = "{}";
      }
      styles = { ...styles, ...compileDataStyles(stylesText) };
    }
  }

  return styles;
}

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

type QuerySpec = NamedQuerySpec | QueryStringSpec | QueryFileSpec;

// TODO Come up with a better way to handle data styles. Perhaps this is
//      an in-language understanding of model "metadata". For now,
//      we abuse the `URLReader` API to keep track of requested URLs
//      and accummulate data styles for those files.
class HackyDataStylesAccumulator implements URLReader {
  private uriReader: URLReader;
  private dataStyles: DataStyles = {};

  constructor(uriReader: URLReader) {
    this.uriReader = uriReader;
  }

  async readURL(uri: URL): Promise<string> {
    const contents = await this.uriReader.readURL(uri);
    this.dataStyles = {
      ...this.dataStyles,
      ...(await dataStylesForFile(uri.toString(), contents)),
    };

    return contents;
  }

  getHackyAccumulatedDataStyles() {
    return this.dataStyles;
  }
}

export function runMalloyQuery(
  query: QuerySpec,
  panelId: string,
  name: string,
  renderMode: QueryRenderMode = QueryRenderMode.HTML
): void {
  if (renderStyle === "json") {
    panelId += " Data";
  }
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Malloy Query (${name})`,
      cancellable: true,
    },
    (progress, token) => {
      let canceled = false;

      const cancel = () => {
        canceled = true;
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
        previous.panel.reveal();
      } else {
        const panel = vscode.window.createWebviewPanel(
          "malloyQuery",
          name,
          vscode.ViewColumn.Two,
          { enableScripts: true, retainContextWhenHidden: true }
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
        current.panel.title = name;
        MALLOY_EXTENSION_STATE.setRunState(panelId, current);
      }

      const onDiskPath = vscode.Uri.file(
        path.join(__filename, "..", "query_webview.js")
      );

      const entrySrc = current.panel.webview.asWebviewUri(onDiskPath);

      current.panel.webview.html = getWebviewHtml(entrySrc.toString());

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

      const vscodeFiles = new VSCodeURLReader();
      const files = new HackyDataStylesAccumulator(vscodeFiles);
      const runtime = new Runtime(files, CONNECTION_MAP);

      return (async () => {
        try {
          malloyLog.appendLine("");
          const allBegin = performance.now();
          const compileBegin = allBegin;

          current.messages.postMessage({
            type: QueryMessageType.QueryStatus,
            status: QueryRunStatus.Compiling,
          });
          progress.report({ increment: 20, message: "Compiling" });

          let queryMaterializer;
          let styles: DataStyles = {};
          if (query.type === "string") {
            queryMaterializer = runtime
              .loadModel(URL.fromString("file://" + query.file.uri.fsPath))
              .loadQuery(query.text);
          } else if (query.type === "named") {
            queryMaterializer = runtime.loadQueryByName(
              URL.fromString("file://" + query.file.uri.fsPath),
              query.name
            );
          } else {
            queryMaterializer = runtime.loadQueryByIndex(
              URL.fromString("file://" + query.file.uri.fsPath),
              query.index
            );
          }

          try {
            const sql = await queryMaterializer.getSQL();
            styles = { ...styles, ...files.getHackyAccumulatedDataStyles() };

            if (canceled) return;
            malloyLog.appendLine(sql);
          } catch (error) {
            current.messages.postMessage({
              type: QueryMessageType.QueryStatus,
              status: QueryRunStatus.Error,
              error: error.message || "Something went wrong",
            });
            return;
          }

          const compileEnd = performance.now();
          logTime("Compile", compileBegin, compileEnd);

          const runBegin = compileEnd;

          current.messages.postMessage({
            type: QueryMessageType.QueryStatus,
            status: QueryRunStatus.Running,
          });
          progress.report({ increment: 40, message: "Running" });
          const queryResult = await queryMaterializer.run();
          if (canceled) return;

          const runEnd = performance.now();
          logTime("Run", runBegin, runEnd);

          current.messages.postMessage({
            type: QueryMessageType.QueryStatus,
            status: QueryRunStatus.Done,
            result: queryResult.toJSON(),
            styles,
            mode: renderMode,
          });
          current.result = queryResult;
          progress.report({ increment: 80, message: "Rendering" });

          const allEnd = performance.now();
          logTime("Total", allBegin, allEnd);
        } catch (error) {
          current.messages.postMessage({
            type: QueryMessageType.QueryStatus,
            status: QueryRunStatus.Error,
            error: error.message,
          });
        }
      })();
    }
  );
}

export function compileDataStyles(styles: string): DataStyles {
  try {
    return JSON.parse(styles) as DataStyles;
  } catch (error) {
    throw new Error(`Error compiling data styles: ${error.message}`);
  }
}

function logTime(name: string, start: number, end: number) {
  malloyLog.appendLine(
    `${name} time: ${((end - start) / 1000).toLocaleString()}s`
  );
}
