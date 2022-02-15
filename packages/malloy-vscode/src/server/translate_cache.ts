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

import { TextDocuments } from "vscode-languageserver/node";
import { Model, Runtime, URL } from "@malloydata/malloy";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as fs from "fs";
import { CONNECTION_MANAGER } from "./connections";

const TRANSLATE_CACHE = new Map<string, { model: Model; version: number }>();

async function getDocumentText(
  documents: TextDocuments<TextDocument>,
  uri: string
): Promise<string> {
  const cached = documents.get(uri);
  if (cached) {
    return cached.getText();
  } else {
    // TODO catch a file read error
    return fs.readFileSync(uri.replace(/^file:\/\//, ""), "utf8");
  }
}

export async function translateWithCache(
  document: TextDocument,
  documents: TextDocuments<TextDocument>
): Promise<Model> {
  const currentVersion = document.version;
  const uri = document.uri.toString();

  const entry = TRANSLATE_CACHE.get(uri);
  if (entry && entry.version === currentVersion) {
    return Promise.resolve(entry.model);
  }

  const files = {
    readURL: (url: URL) => getDocumentText(documents, url.toString()),
  };
  const runtime = new Runtime(files, CONNECTION_MANAGER.connections);

  const model = await runtime.getModel(new URL(uri));
  TRANSLATE_CACHE.set(uri, { version: currentVersion, model });
  return model;
}
