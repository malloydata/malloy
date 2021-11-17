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
import { MALLOY_EXTENSION_STATE } from "../state";

export async function showResultJSONCommand(): Promise<void> {
  const panelId = MALLOY_EXTENSION_STATE.getActiveWebviewPanelId();
  if (panelId === undefined) {
    vscode.window.showErrorMessage("No result is focused.");
    return;
  }

  const result = MALLOY_EXTENSION_STATE.getRunState(panelId)?.result;
  if (result === undefined) {
    vscode.window.showErrorMessage("Query has no results.");
    return;
  }

  const document = await vscode.workspace.openTextDocument({
    language: "json",
    content: JSON.stringify(result, null, 2),
  });

  await vscode.window.showTextDocument(document, { preview: true });
}
