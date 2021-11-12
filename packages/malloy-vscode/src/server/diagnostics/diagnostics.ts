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
import { LogMessage, MalloyError, Runtime, Url } from "@malloy-lang/malloy";
import { TextDocument } from "vscode-languageserver-textdocument";
import * as fs from "fs";
import { BigQueryConnection } from "@malloy-lang/db-bigquery";

const BIGQUERY_CONNECTION = new BigQueryConnection("bigquery");

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

  const uri = document.uri.toString();
  const files = {
    readUrl: (url: Url) => magicGetTheFile(documents, url.toString()),
  };
  const runtime = new Runtime(files, BIGQUERY_CONNECTION);
  let errors: LogMessage[] = [];
  try {
    await runtime.getModel(new Url(uri));
  } catch (error) {
    if (error instanceof MalloyError) {
      errors = error.log;
    } else {
      // TODO this kind of error should cease to exist. All errors should have source info.
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

  return diagnostics;
}
