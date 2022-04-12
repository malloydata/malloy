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
import { TextDocument } from "vscode-languageserver-textdocument";
import { translateWithCache } from "../translate_cache";

export async function getMalloyDefinitionReference(
  documents: TextDocuments<TextDocument>,
  document: TextDocument,
  position: Position
): Promise<Location[]> {
  try {
    const response = await translateWithCache(document, documents);
    if (response.isSuccess()) {
      const model = response.result;
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
    }
    return [];
  } catch {
    // TODO It's probably possible to get some references from a model that has errors;
    //      maybe the Model api should not throw an error if there are errors, but just
    //      make them available via `.errors` or something.
    return [];
  }
}
