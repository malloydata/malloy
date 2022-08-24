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

import { Hover, HoverParams, MarkupKind } from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Malloy } from "@malloydata/malloy";
import { COMPLETION_DOCS } from "../completions/completion_docs";

export const getHover = (
  document: TextDocument,
  { position }: HoverParams
): Hover | null => {
  const context = Malloy.parse({ source: document.getText() }).helpContext(
    position
  );

  if (context?.token) {
    const name = context.token.replace(/:$/, "");

    if (name) {
      const value = COMPLETION_DOCS[context.type][name];
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value,
        },
      };
    }
  }

  return null;
};
