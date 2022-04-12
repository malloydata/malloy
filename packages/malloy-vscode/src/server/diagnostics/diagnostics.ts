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
import { Log, LogMessage, MalloyError } from "@malloydata/malloy";
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
  const log = new Log();
  try {
    await translateWithCache(document, documents, log);
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

  function mapMessage(message: LogMessage, severity: DiagnosticSeverity) {
    return {
      severity,
      range: message.at?.range || DEFAULT_RANGE,
      message: message.message,
      source: "malloy",
    };
  }

  for (const error of log.errors) {
    diagnostics.push(mapMessage(error, DiagnosticSeverity.Error));
  }

  for (const warning of log.warnings) {
    diagnostics.push(mapMessage(warning, DiagnosticSeverity.Warning));
  }

  for (const info of log.infos) {
    diagnostics.push(mapMessage(info, DiagnosticSeverity.Information));
  }

  return diagnostics;
}
