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
  Diagnostic,
  DiagnosticSeverity,
  TextDocuments,
} from "vscode-languageserver/node";
import { LogMessage, MalloyError } from "@malloydata/malloy";
import { TextDocument } from "vscode-languageserver-textdocument";
import { translateWithCache } from "../translate_cache";

const DEFAULT_RANGE = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: Number.MAX_VALUE },
};

export async function getMalloyDiagnostics(
  documents: TextDocuments<TextDocument>,
  document: TextDocument
): Promise<{ [uri: string]: Diagnostic[] }> {
  const byURI: { [uri: string]: Diagnostic[] } = {
    // Important that the requested document starts out as empty array,
    // so that we clear old diagnostics
    [document.uri]: [],
  };
  let errors: LogMessage[] = [];
  try {
    await translateWithCache(document, documents);
  } catch (error) {
    if (error instanceof MalloyError) {
      errors = error.log;
    } else {
      // TODO this kind of error should cease to exist. All errors should have source info.
      byURI[document.uri].push({
        severity: DiagnosticSeverity.Error,
        range: DEFAULT_RANGE,
        message: error.message,
        source: "malloy",
      });
    }
  }

  for (const err of errors) {
    const sev =
      err.severity === "warn"
        ? DiagnosticSeverity.Warning
        : err.severity === "debug"
        ? DiagnosticSeverity.Information
        : DiagnosticSeverity.Error;

    const uri = err.at ? err.at.url : document.uri;

    if (byURI[uri] === undefined) {
      byURI[uri] = [];
    }

    byURI[uri].push({
      severity: sev,
      range: err.at?.range || DEFAULT_RANGE,
      message: err.message,
      source: "malloy",
    });
  }

  return byURI;
}
