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

    webviewView.webview.html = getWebviewHtml(entrySrc.toString());
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
    // const scriptUri = webview.asWebviewUri(
    //   vscode.Uri.joinPath(this._extensionUri, "media", "main.js")
    // );

    // // Do the same for the stylesheet.
    // const styleResetUri = webview.asWebviewUri(
    //   vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")
    // );
    // const styleVSCodeUri = webview.asWebviewUri(
    //   vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
    // );
    // const styleMainUri = webview.asWebviewUri(
    //   vscode.Uri.joinPath(this._extensionUri, "media", "main.css")
    // );

    // Use a nonce to only allow a specific script to be run.
    const nonce = "dfsd";

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <!--
          Use a content security policy to only allow loading images from https or from our extension directory,
          and only allow scripts that have a specific nonce.
        -->
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <title>Cat Colors</title>
      </head>
      <body>
        <ul class="color-list">
        </ul>
        <button class="add-color-button">Add Color</button>
      </body>
      </html>`;
  }
}
