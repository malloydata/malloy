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
import { Malloy, MalloyTranslator, LogMessage, BigQuery } from "malloy";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as fs from "fs";

Malloy.setDB(new BigQuery());

async function magicGetTheFile(
  documents: TextDocuments<TextDocument>,
  uri: string
): Promise<string> {
  const cached = documents.get(uri);
  if (cached) {
    return cached.getText();
  } else {
    return fs.readFileSync(uri.replace(/^file:\/\//, ""), "utf8");
    // TODO catch this error
  }
}

export async function getMalloyDiagnostics(
  documents: TextDocuments<TextDocument>,
  document: TextDocument
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];

  try {
    const uri = document.uri.toString();
    const translator = new MalloyTranslator(uri, {
      URLs: {
        [uri]: document.getText(),
      },
    });
    let done = false;
    let errors: LogMessage[] = [];
    while (!done) {
      const result = translator.translate();
      done = result.final || false;
      if (result.errors) {
        errors = result.errors;
      }
      if (result.translated) {
        // result.translated.queryList has unnamed queries
        // result.translated.modelDef has the model
      } else if (result.URLs) {
        for (const neededUri of result.URLs) {
          const theNeeded = await magicGetTheFile(documents, neededUri);
          translator.update({ URLs: { [neededUri]: theNeeded } });
        }
      } else if (result.tables) {
        const tables = await Malloy.db.getSchemaForMissingTables(result.tables);
        translator.update({ tables });
      }
    }

    for (const err of errors) {
      const sev =
        err.severity === "warn"
          ? DiagnosticSeverity.Warning
          : err.severity === "debug"
          ? DiagnosticSeverity.Information
          : DiagnosticSeverity.Error;

      diagnostics.push({
        severity: sev,
        range: {
          start: {
            line: (err.begin?.line || 1) - 1,
            character: err.begin?.char || 0,
          },
          end: {
            line: (err.end?.line || err.begin?.line || 1) - 1,
            character: err.end?.char || Number.MAX_VALUE,
          },
        },
        message: err.message,
        source: "malloy",
      });
    }
  } catch (error) {
    diagnostics.push({
      severity: DiagnosticSeverity.Error,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: Number.MAX_VALUE },
      },
      message: error.message,
      source: "malloy",
    });
  }

  return diagnostics;
}
