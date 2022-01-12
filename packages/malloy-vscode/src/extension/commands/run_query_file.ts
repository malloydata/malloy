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
import { runMalloyQuery, RunRenderStyle } from "./run_query_utils";

export function runQueryFileCommand(
  queryIndex = -1,
  renderStyle: RunRenderStyle = "html"
): void {
  const document = vscode.window.activeTextEditor?.document;
  if (document) {
    runMalloyQuery(
      { type: "file", index: queryIndex, file: document },
      document.uri.toString(),
      document.fileName.split("/").pop() || document.fileName,
      renderStyle
    );
  }
}
