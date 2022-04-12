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
import { MalloyError } from "@malloydata/malloy";
import { TextDocument } from "vscode-languageserver-textdocument";
import { translateWithCache } from "../translate_cache";

const DEFAULT_RANGE = {
  start: { line: 0, character: 0 },
  end: { line: 0, character: Number.MAX_VALUE },
};

export async function getMalloyDiagnostics(
  documents: TextDocuments<TextDocument>,
  document: TextDocument
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  try {
    const response = await translateWithCache(document, documents);
    for (const message of response.logs) {
      const severity =
        message.severity === "warn"
          ? DiagnosticSeverity.Warning
          : message.severity === "debug"
          ? DiagnosticSeverity.Information
          : DiagnosticSeverity.Error;
      diagnostics.push({
        severity,
        range: message.at?.range || DEFAULT_RANGE,
        message: message.message,
        source: "malloy",
      });
    }
  } catch (error) {
    if (!(error instanceof MalloyError)) {
      // TODO this kind of error should cease to exist. All errors should have source info.
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: DEFAULT_RANGE,
        message: error.message,
        source: "malloy",
      });
    }
  }

  return diagnostics;
}
