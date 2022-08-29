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
import { randomInt } from "crypto";
import { promises as fs } from "fs";

export async function fetchFile(path: string): Promise<string> {
  const openFiles = vscode.workspace.textDocuments;
  const openDocument = openFiles.find(
    (document) => document.uri.fsPath === path
  );
  // Only get the text from VSCode's open files if the file is alredy open in VSCode,
  // otherwise, just read the file from the file system
  if (openDocument !== undefined) {
    return openDocument.getText();
  } else {
    return fs.readFile(path, "utf-8");
  }
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

const CLIENT_ID_CHARACTERS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomClientIdCharacter() {
  return CLIENT_ID_CHARACTERS.charAt(
    Math.floor(randomInt(0, CLIENT_ID_CHARACTERS.length))
  );
}

export function getNewClientId(): string {
  return Array.from({ length: 32 }, randomClientIdCharacter).join("");
}
