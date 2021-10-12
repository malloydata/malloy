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
import { Malloy, MalloyTranslator, ModelDef } from "malloy";
import { DataStyles, HtmlView, DataTreeRoot } from "malloy-render";
import { loadingIndicator, renderErrorHtml, wrapHTMLSnippet } from "../html";
import { MALLOY_EXTENSION_STATE, RunState } from "../state";
import turtleIcon from "../../media/turtle.svg";
import { getWebviewHtml } from "../../webview";

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

async function compile(uri: string, malloy: string, model?: ModelDef) {
  let dataStyles = await dataStylesForFile(uri, malloy);
  const translator = new MalloyTranslator(uri, { URLs: { [uri]: malloy } });
  translator.translate(model);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = translator.translate();
    if (result.final) {
      return { result, dataStyles };
    } else if (result.URLs) {
      for (const neededUri of result.URLs) {
        const neededText = await fetchFile(neededUri);
        const URLs = { [neededUri]: neededText };
        translator.update({ URLs });
        dataStyles = {
          ...dataStyles,
          ...(await dataStylesForFile(neededUri, neededText)),
        };
      }
    } else if (result.tables) {
      const tables = await Malloy.db.getSchemaForMissingTables(result.tables);
      translator.update({ tables });
    }
  }
}

async function fetchFile(uri: string): Promise<string> {
  return (
    await vscode.workspace.openTextDocument(uri.replace(/^file:\/\//, ""))
  ).getText();
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

      return (async () => {
        try {
          malloyLog.appendLine("");
          const allBegin = performance.now();
          const compileBegin = allBegin;
          const malloy = new Malloy();

          current.panel.webview.html = wrapHTMLSnippet(
            loadingIndicator("Compiling")
          );
          progress.report({ increment: 20, message: "Compiling" });

          let compiledQuery;
          let error;
          let styles: DataStyles = {};
          if (query.type === "string") {
            let model;
            {
              const { result, dataStyles } = await compile(
                query.file.uri.toString(),
                query.file.getText()
              );
              if (result.translated) {
                model = result.translated.modelDef;
                styles = dataStyles;
              } else if (result?.errors) {
                error = result.errors[0].message;
              }
            }
            if (model) {
              const fakeUri = path.join(
                query.file.uri.toString(),
                "..",
                "__QUERY__.malloy"
              );
              const { result, dataStyles } = await compile(
                fakeUri,
                query.text,
                model
              );
              if (result.translated) {
                const q =
                  result.translated.queryList[
                    result.translated.queryList.length - 1
                  ];
                malloy.model = result.translated.modelDef;
                compiledQuery = await malloy.compileQuery(q);
                styles = { ...styles, ...dataStyles };
              } else if (result?.errors) {
                error = result.errors[0].message;
              }
            }
          } else if (query.type === "named") {
            const { result, dataStyles } = await compile(
              query.file.uri.toString(),
              query.file.getText()
            );
            if (result.translated) {
              const struct = result.translated.modelDef.structs[query.name];
              if (struct.type === "struct") {
                const source = struct.structSource;
                if (source.type === "query") {
                  malloy.model = result.translated.modelDef;
                  compiledQuery = await malloy.compileQuery(source.query);
                  styles = dataStyles;
                }
              }

              if (compiledQuery === undefined) {
                current.panel.webview.html = renderErrorHtml(
                  new Error(`${query.name} is not a named query.`)
                );
                return;
              }
            } else if (result.errors) {
              error = result.errors[0].message;
            }
          } else {
            const { result, dataStyles } = await compile(
              query.file.uri.toString(),
              query.file.getText()
            );
            if (result?.translated) {
              const index =
                query.index === -1
                  ? result.translated.queryList.length - 1
                  : query.index;
              const q = result.translated.queryList[index];
              malloy.model = result.translated.modelDef;
              compiledQuery = await malloy.compileQuery(q);
              styles = dataStyles;
            } else if (result?.errors) {
              error = result.errors[0]?.message;
            }
          }

          if (!compiledQuery) {
            current.panel.webview.html = renderErrorHtml(
              new Error(error || "Something went wrong.")
            );
            return;
          }

          if (canceled) return;
          malloyLog.appendLine(compiledQuery.sql);

          const compileEnd = performance.now();
          logTime("Compile", compileBegin, compileEnd);

          const runBegin = compileEnd;

          current.panel.webview.html = wrapHTMLSnippet(
            loadingIndicator("Running")
          );
          progress.report({ increment: 40, message: "Running" });
          const queryResult = await malloy.runCompiledQuery(compiledQuery, 50);
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
