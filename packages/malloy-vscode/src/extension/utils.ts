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

import { fileURLToPath } from "node:url";
import { URLReader } from "@malloydata/malloy";
import * as vscode from "vscode";

export async function fetchFile(path: string): Promise<string> {
  return (await vscode.workspace.openTextDocument(path)).getText();
}

export class VSCodeURLReader implements URLReader {
  async readURL(url: URL): Promise<string> {
    switch (url.protocol) {
      case "file:":
        return fetchFile(fileURLToPath(url));
      default:
        throw new Error(
          `Protocol ${url.protocol} not implemented in VSCodeURLReader.`
        );
    }
  }
}
