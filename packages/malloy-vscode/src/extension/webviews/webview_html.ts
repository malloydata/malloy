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

export function getWebviewHtml(entrySrc: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Malloy Query Results</title>
  </head>
  <style>
    html,body,#app {
      height: 100%;
      margin: 0;
    }
    body {
      background-color: transparent;
      font-size: 11px;
    }
  </style>
  <body>
    <div id="app"></div>
  </body>
  <script src="${entrySrc}"></script>
</html>`;
}
