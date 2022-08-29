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

import {
  CompletionParams,
  CompletionItem,
  CompletionItemKind,
  MarkupKind,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Malloy } from "@malloydata/malloy";
import { COMPLETION_DOCS } from "./completion_docs";

export function getCompletionItems(
  document: TextDocument,
  context: CompletionParams
): CompletionItem[] {
  const completions = Malloy.parse({ source: document.getText() }).completions(
    context.position
  );
  return completions.map((completion) => {
    return {
      kind: CompletionItemKind.Property,
      label: completion.text,
      data: {
        type: completion.type,
        property: completion.text.substring(0, completion.text.length - 2),
      },
    };
  });
}

export function resolveCompletionItem(item: CompletionItem): CompletionItem {
  item.detail = item.data.property;
  const docs = (COMPLETION_DOCS[item.data.type] || {})[item.data.property];
  if (docs) {
    item.documentation = {
      kind: MarkupKind.Markdown,
      value: docs,
    };
  }
  return item;
}
