/*
 * Copyright 2022 Google LLC
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

import { TextDocuments, Location, Position } from "vscode-languageserver/node";
import { Runtime, URL } from "@malloydata/malloy";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as fs from "fs";
import { CONNECTION_MANAGER } from "../connections";

// TODO jump-to-definition This code is duplicated
async function magicGetTheFile(
  documents: TextDocuments<TextDocument>,
  uri: string
): Promise<string> {
  const cached = documents.get(uri);
  if (cached) {
    return cached.getText();
  } else {
    return fs.readFileSync(uri.replace(/^file:\/\//, ""), "utf8");
    // TODO catch this error
  }
}

export async function getMalloyDefinitionReference(
  documents: TextDocuments<TextDocument>,
  document: TextDocument,
  position: Position
): Promise<Location[]> {
  const uri = document.uri.toString();
  const files = {
    readURL: (url: URL) => magicGetTheFile(documents, url.toString()),
  };
  const runtime = new Runtime(files, CONNECTION_MANAGER.connections);
  try {
    // TODO jump-to-definition Cache the model so diagnostics and definitions can share work
    const model = await runtime.getModel(new URL(uri));
    const reference = model.getReference(position);
    const location = reference?.definition.location;
    if (location) {
      return [
        {
          uri: location.url,
          range: location.range,
        },
      ];
    }
    return [];
  } catch {
    return [];
  }
}
