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
import { randomInt } from "crypto";

export function getWebviewHtml(
  entrySrc: vscode.Uri,
  webview: vscode.Webview
): string {
  const cspSrc = webview.cspSource;
  const codiconsUri = webview.asWebviewUri(
    vscode.Uri.joinPath(entrySrc, "..", "codicon.css")
  );

  const nonce = getNonce();
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta
      http-equiv="Content-Security-Policy"
      content="base-uri 'none'; default-src 'none'; style-src ${cspSrc} 'unsafe-inline'; img-src ${cspSrc} https:; script-src 'nonce-${nonce}' 'unsafe-eval'; font-src ${cspSrc}"
    >
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${codiconsUri}" rel="stylesheet" />
    <title>Malloy Query Results</title>
  </head>
  <style>
    html,body,#app {
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    body {
      background-color: transparent;
      font-size: 11px;
    }
    .placeholder-vertical-center {
      display: flex;
      flex-direction: column;
      justify-content: center;
      flex: 1 0 auto;
      width: 100%;
      height: 100%;
    }
    .placeholder-horizontal-center {
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
    }
    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(359deg);
      }
    }
    .placeholder-spinning-svg {
      width: 25px;
      height: 25px;
      animation: spin 2s infinite linear;
    }
    .placeholder-label {
      margin-bottom: 10px;
      color: #505050;
      font-size: 15px;
    }
  </style>
  <body>
    <div id="app">
      <div class="placeholder-vertical-center">
        <div class="placeholder-horizontal-center">
          <div class="placeholder-label">Loading</div>
          <div class="placeholder-spinning-svg">
            <svg width="25px" height="25px" viewBox="0 0 15 15" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
              <title>malloy-icon-status-progress</title>
              <defs>
                  <circle id="path-1" cx="7.5" cy="7.5" r="7.5"></circle>
                  <mask id="mask-2" maskContentUnits="userSpaceOnUse" maskUnits="objectBoundingBox" x="0" y="0" width="15" height="15" fill="white">
                      <use xlink:href="#path-1"></use>
                  </mask>
              </defs>
              <g id="malloy-icon-status-progress" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-dasharray="16">
                  <use id="Oval-Copy-3" stroke="#1a73e8" mask="url(#mask-2)" stroke-width="3" transform="translate(7.500000, 7.500000) rotate(-240.000000) translate(-7.500000, -7.500000) " xlink:href="#path-1"></use>
              </g>
            </svg>
          </div>
        </HorizontalCenter>
      </div>
    </div>
  </body>
  <script nonce="${nonce}" src="${entrySrc}"></script>
</html>`;
}

const NONCE_CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomNonceCharacter() {
  return NONCE_CHARACTERS.charAt(
    Math.floor(randomInt(0, NONCE_CHARACTERS.length))
  );
}

function getNonce() {
  return Array.from({ length: 32 }, randomNonceCharacter).join("");
}
