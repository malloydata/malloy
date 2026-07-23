/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {CompletionParams, CompletionItem} from 'vscode-languageserver';
import {CompletionItemKind, MarkupKind} from 'vscode-languageserver';
import type {TextDocument} from 'vscode-languageserver-textdocument';
import {COMPLETION_DOCS} from '../common/completion_docs';
import {parseWithCache} from '../parse_cache';
import type {TranslateCache} from '../translate_cache';
import {getSchemaCompletions} from './schema_completions';

export async function getCompletionItems(
  document: TextDocument,
  context: CompletionParams,
  translateCache: TranslateCache
): Promise<CompletionItem[]> {
  const schemaCompletions = await getSchemaCompletions(
    document,
    context,
    translateCache
  );
  if (schemaCompletions) {
    return schemaCompletions.map(completion => {
      return {
        kind: CompletionItemKind.Field,
        label: completion,
      };
    });
  }
  const completions = parseWithCache(document).completions(context.position);
  const cleanedCompletions: CompletionItem[] = completions.map(completion => {
    return {
      kind: CompletionItemKind.Property,
      label: completion.text,
      data: {
        type: completion.type,
        property: completion.text.substring(0, completion.text.length - 2),
      },
    };
  });
  return cleanedCompletions;
}

export function resolveCompletionItem(item: CompletionItem): CompletionItem {
  if (item.data) {
    const data = item.data;
    item.detail = data.property;
    const docs = (COMPLETION_DOCS[data.type] || {})[data.property];
    if (docs) {
      item.documentation = {
        kind: MarkupKind.Markdown,
        value: docs,
      };
    }
  }
  return item;
}
