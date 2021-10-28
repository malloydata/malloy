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
import { Runtime, UriReader } from "malloy";
import { DataStyles, HtmlView, DataTreeRoot } from "malloy-render";
import { loadingIndicator, renderErrorHtml, wrapHTMLSnippet } from "../html";
import { BIGQUERY_CONNECTION, MALLOY_EXTENSION_STATE, RunState } from "../state";
import turtleIcon from "../../media/turtle.svg";
import { BigQueryConnection } from "malloy-db-bigquery";
import { fetchFile, VscodeUriReader } from "../utils";

const malloyLog = vscode.window.createOutputChannel("Malloy");

const css = `<style>
body {
	background-color: transparent;
  font-size: 11px;
}
</style>
`;

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

class HackyDataStylesAccumulator implements UriReader {
  private uriReader: UriReader;
  private dataStyles: DataStyles = {};

  constructor(uriReader: UriReader) {
    this.uriReader = uriReader;
  }

  async readUri(uri: string): Promise<string> {
    const contents = await this.uriReader.readUri(uri);
    this.dataStyles = {
      ...this.dataStyles,
      ...(await dataStylesForFile(uri, contents)),
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
  name: string
): void {
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
          document: previous.document,
        };
        MALLOY_EXTENSION_STATE.setRunState(panelId, current);
        previous.cancel();
        previous.panel.reveal();
      } else {
        current = {
          panel: vscode.window.createWebviewPanel(
            "malloyQuery",
            name,
            vscode.ViewColumn.Two,
            { enableScripts: true }
          ),
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

      const vscodeFiles = new VscodeUriReader();
      const files = new HackyDataStylesAccumulator(vscodeFiles);

      const runtime = new Runtime(
        files,
        BIGQUERY_CONNECTION,
        BIGQUERY_CONNECTION
      );

      return (async () => {
        try {
          malloyLog.appendLine("");
          const allBegin = performance.now();
          const compileBegin = allBegin;

          current.panel.webview.html = wrapHTMLSnippet(
            loadingIndicator("Compiling")
          );
          progress.report({ increment: 20, message: "Compiling" });

          let translatedQuery;
          let error;
          let styles: DataStyles = {};
          if (query.type === "string") {
            translatedQuery = await runtime.translateQuery(
              { string: query.text },
              { uri: "file://" + query.file.uri.fsPath }
            );
          } else if (query.type === "named") {
            translatedQuery = await runtime.translateNamedQuery(
              { uri: "file://" + query.file.uri.fsPath },
              query.name
            );
          } else {
            translatedQuery = await runtime.translateUnnamedQuery(
              { uri: "file://" + query.file.uri.fsPath },
              query.index
            );
          }

          if (!translatedQuery) {
            current.panel.webview.html = renderErrorHtml(
              new Error(error || "Something went wrong.")
            );
            return;
          }

          styles = { ...styles, ...files.getHackyAccumulatedDataStyles() };

          if (canceled) return;
          malloyLog.appendLine(translatedQuery.getSql());

          const compileEnd = performance.now();
          logTime("Compile", compileBegin, compileEnd);

          const runBegin = compileEnd;

          current.panel.webview.html = wrapHTMLSnippet(
            loadingIndicator("Running")
          );
          progress.report({ increment: 40, message: "Running" });
          const queryResult = await runtime.execute(translatedQuery);
          if (canceled) return;

          const runEnd = performance.now();
          logTime("Run", runBegin, runEnd);

          current.panel.webview.html = wrapHTMLSnippet(
            loadingIndicator("Rendering")
          );
          current.result = queryResult;
          progress.report({ increment: 80, message: "Rendering" });

          return new Promise<void>((resolve) => {
            // This setTimeout is to allow the extension to set the HTML fully
            // to say that we're rendering before we start doing so. This makes
            // the message onscreen accurate to what's happening.
            setTimeout(async () => {
              const renderBegin = runEnd;

              const data = queryResult.result;
              const field = queryResult.structs.find(
                (s) => s.name === queryResult.lastStageName
              );

              if (field) {
                const namedQueryName =
                  query.type === "named" ? query.name : undefined;
                const namedField = {
                  ...field,
                  name: namedQueryName || queryResult.queryName || field.name,
                };
                const table = new DataTreeRoot(
                  data,
                  namedField,
                  queryResult.sourceExplore,
                  queryResult.sourceFilters || []
                );
                current.panel.webview.html = wrapHTMLSnippet(
                  css + (await new HtmlView().render(table, styles))
                );

                const renderEnd = performance.now();
                logTime("Render", renderBegin, renderEnd);

                const allEnd = renderEnd;
                logTime("Total", allBegin, allEnd);
              }
              resolve();
            }, 0);
          });
        } catch (error) {
          current.panel.webview.html = renderErrorHtml(error);
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
