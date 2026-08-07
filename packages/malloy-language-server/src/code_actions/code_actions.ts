/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {CodeAction, Command, Range} from 'vscode-languageserver';
import {CodeActionKind} from 'vscode-languageserver';
import type {TextDocument} from 'vscode-languageserver-textdocument';
import type {TranslateCache} from '../translate_cache';
import type {LogMessage} from '@malloydata/malloy';
import {MalloyError} from '@malloydata/malloy';

export async function getMalloyCodeAction(
  translateCache: TranslateCache,
  document: TextDocument,
  range: Range
): Promise<(CodeAction | Command)[] | null> {
  const problems: LogMessage[] = [];
  try {
    const model = await translateCache.translateWithCache(
      document.uri,
      document.languageId
    );
    if (model?.problems) {
      problems.push(...model.problems);
    }
  } catch (error) {
    if (error instanceof MalloyError) {
      problems.push(...error.problems);
    }
  }
  const actions: CodeAction[] = [];
  for (const problem of problems) {
    if (problem.at?.range) {
      const par = problem.at.range;
      if (
        par.start.line === range.start.line &&
        par.start.character === range.start.character &&
        par.end.line === range.end.line &&
        par.end.character === range.end.character &&
        problem.replacement
      ) {
        const edit = {
          changes: {
            [document.uri]: [
              {
                range,
                newText: problem.replacement,
              },
            ],
          },
        };
        const codeAction: CodeAction = {
          title: `Replace with ${problem.replacement}`,
          kind: CodeActionKind.QuickFix,
          edit,
        };
        actions.push(codeAction);
      }
    }
  }
  return actions;
}
