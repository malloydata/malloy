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

import * as vscode from "vscode";
import { runMalloyQuery } from "./run_query_utils";

export function runQueryWithEdit(
  exploreName: string,
  turtleName: string
): void {
  const document = vscode.window.activeTextEditor?.document;
  if (document) {
    (async () => {
      const cursorPosition =
        `explore ${exploreName}`.length + (turtleName.length === 0 ? 3 : 0);
      const query = await vscode.window.showInputBox({
        title: "Run Malloy Query",
        prompt: "Enter your Malloy query...",
        value: `query: ${exploreName}-> ${turtleName || ""}`,
        valueSelection: [cursorPosition, cursorPosition],
      });
      if (query) {
        runMalloyQuery(
          { type: "string", text: query, file: document },
          true,
          `${document.uri.toString()} ${exploreName} | ...`,
          `${exploreName} | ...`
        );
      }
    })();
  }
}
