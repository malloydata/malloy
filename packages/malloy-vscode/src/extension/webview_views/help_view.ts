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
import * as path from "path";
import { getWebviewHtml } from "../webviews";
import { HelpMessageType, HelpPanelMessage } from "../message_types";
import { WebviewMessageManager } from "../webview_message_manager";

export class HelpViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    const onDiskPath = vscode.Uri.file(
      path.join(__filename, "..", "help_page.js")
    );

    const entrySrc = webviewView.webview.asWebviewUri(onDiskPath);

    webviewView.webview.html = getWebviewHtml(
      entrySrc.toString(),
      webviewView.webview
    );

    const messageManager = new WebviewMessageManager<HelpPanelMessage>(
      webviewView
    );

    messageManager.onReceiveMessage((message) => {
      if (message.type === HelpMessageType.EditConnections) {
        vscode.commands.executeCommand("malloy.editConnections");
      }
    });
  }
}
