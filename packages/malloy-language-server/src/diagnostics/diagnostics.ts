/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Diagnostic} from 'vscode-languageserver';
import {DiagnosticSeverity} from 'vscode-languageserver';
import type {LogMessage} from '@malloydata/malloy';
import {MalloyError} from '@malloydata/malloy';
import type {TextDocument} from 'vscode-languageserver-textdocument';
import type {TranslateCache} from '../translate_cache';
import {parseMalloySQLSQLWithCache} from '../parse_cache';
import {errorMessage} from '../common/errors';
import {prettyLogUri} from '../common/log';
const errorDictURI =
  'https://docs.malloydata.dev/documentation/error_dictionary';

const DEFAULT_RANGE = {
  start: {line: 0, character: 0},
  end: {line: 0, character: Number.MAX_VALUE},
};

export async function getMalloyDiagnostics(
  translateCache: TranslateCache,
  document: TextDocument
): Promise<{[uri: string]: Diagnostic[]}> {
  const byURI: {[uri: string]: Diagnostic[]} = {
    [document.uri]: [],
  };
  const problems: LogMessage[] = [];

  if (document.languageId === 'malloy-sql') {
    const {errors} = parseMalloySQLSQLWithCache(document);
    if (errors) errors.forEach(e => problems.push(...e.problems));
  }

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
    } else {
      byURI[document.uri].push({
        severity: DiagnosticSeverity.Error,
        range: DEFAULT_RANGE,
        message: errorMessage(error),
        source: 'malloy',
      });
    }
  }

  for (const problem of problems) {
    const sev =
      problem.severity === 'warn'
        ? DiagnosticSeverity.Warning
        : problem.severity === 'debug'
          ? DiagnosticSeverity.Information
          : DiagnosticSeverity.Error;

    const uri = problem.at ? problem.at.url : document.uri;

    if (byURI[uri] === undefined) {
      byURI[uri] = [];
    }

    const range = problem.at?.range || DEFAULT_RANGE;

    if (range.start.line >= 0) {
      const theDiag: Diagnostic = {
        severity: sev,
        range,
        message: problem.message,
        source: 'malloy',
      };
      if (problem.errorTag) {
        theDiag.code = problem.errorTag;
        theDiag.codeDescription = {href: `${errorDictURI}#${theDiag.code}`};
      }
      byURI[uri].push(theDiag);
    }
  }

  console.info(
    `getMalloyDiagnostics: ${prettyLogUri(document.uri)} found ${
      problems.length
    } problems`
  );

  return byURI;
}

export async function aggregateNotebookDiagnostics(
  diagnostics: {[uri: string]: Diagnostic[]},
  translateCache: TranslateCache
): Promise<{[notebookUri: string]: Diagnostic[]}> {
  const result: {[uri: string]: Diagnostic[]} = {};

  for (const [uri, diags] of Object.entries(diagnostics)) {
    let url: URL;
    try {
      url = new URL(uri);
    } catch {
      continue;
    }

    if (url.protocol !== 'vscode-notebook-cell:') continue;

    const notebookUri = `file://${url.pathname}`;

    if (!result[notebookUri]) {
      result[notebookUri] = [];
    }

    if (diags.length === 0) continue;

    try {
      const cellData = await translateCache.getCellData(url);
      const cell = cellData.cells.find(c => c.uri === uri);
      const lineOffset = cell?.lineOffset ?? 0;

      const mappedDiags = diags.map(d => ({
        ...d,
        range: {
          start: {
            line: d.range.start.line + lineOffset,
            character: d.range.start.character,
          },
          end: {
            line: d.range.end.line + lineOffset,
            character: d.range.end.character,
          },
        },
      }));

      result[notebookUri].push(...mappedDiags);
    } catch (error) {
      console.error(
        `Failed to aggregate diagnostics for notebook cell ${uri}:`,
        error
      );
    }
  }

  return result;
}
