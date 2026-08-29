/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {LogMessage, Model} from '@malloydata/malloy';
import {validateRenderTags} from '@malloydata/render-validator';
import type {TextDocument} from 'vscode-languageserver-textdocument';
import {parseWithCache} from '../parse_cache';

/**
 * Validate renderer tag usage for every named and unnamed query in a model.
 *
 * The renderer's own validator inspects compiled query results — column
 * types, tag values, and tag/field-type compatibility — without executing
 * the query or needing a DOM. Errors here would otherwise only appear at
 * render time in the IDE preview; lifting them into LSP diagnostics
 * surfaces them in the editor as the user types.
 */
export function getRenderTagDiagnostics(
  document: TextDocument,
  model: Model
): LogMessage[] {
  if (document.languageId !== 'malloy') return [];

  const out: LogMessage[] = [];
  const parse = parseWithCache(document);
  let unnamedIndex = 0;

  for (const symbol of parse.symbols) {
    if (symbol.type !== 'query' && symbol.type !== 'unnamed_query') continue;

    try {
      const preparedQuery =
        symbol.type === 'query'
          ? model.getPreparedQueryByName(symbol.name)
          : model.getPreparedQueryByIndex(unnamedIndex++);
      const stableResult = preparedQuery.getPreparedResult().toStableResult();
      const renderLogs = validateRenderTags(stableResult);

      for (const log of renderLogs) {
        out.push({
          message: log.message,
          severity: log.severity === 'info' ? 'debug' : log.severity,
          code: 'render-tag',
          errorTag: 'render-tag',
          at: log.url
            ? {url: log.url, range: log.range}
            : {url: document.uri, range: symbol.range.toJSON()},
        });
      }
    } catch {
      // Query failed to compile; the underlying error is already in
      // model.problems, so we skip render validation for this query.
    }
  }

  return out;
}
