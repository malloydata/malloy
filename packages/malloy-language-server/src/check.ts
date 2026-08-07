/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as fs from 'fs';
import * as path from 'path';
import {pathToFileURL} from 'url';
import {TextDocument} from 'vscode-languageserver-textdocument';
import type {Diagnostic} from 'vscode-languageserver';
import {DiagnosticSeverity} from 'vscode-languageserver';
import type {TextDocuments} from 'vscode-languageserver';
import {getMalloyDiagnostics} from './diagnostics';
import type {TranslateCacheLogger} from './translate_cache';
import {TranslateCache} from './translate_cache';
import {CommonConnectionManager} from './common/connection_manager';
import {NodeURLReader} from './node_url_reader';

function severityLabel(severity: DiagnosticSeverity | undefined): string {
  switch (severity) {
    case DiagnosticSeverity.Error:
      return 'error';
    case DiagnosticSeverity.Warning:
      return 'warning';
    case DiagnosticSeverity.Information:
      return 'info';
    case DiagnosticSeverity.Hint:
      return 'hint';
    default:
      return 'error';
  }
}

interface CheckOptions {
  format?: 'text' | 'json';
  globalConfigDir?: string;
}

export async function check(
  files: string[],
  options: CheckOptions = {}
): Promise<number> {
  const {format = 'text', globalConfigDir} = options;
  const urlReader = new NodeURLReader();

  // Dynamically try to load backends; they're optional dependencies
  try {
    require('@malloydata/malloy-connections');
  } catch {
    // Not installed — only config-file connections will work
  }
  try {
    require('@malloydata/db-publisher');
  } catch {
    // Not installed
  }

  const connectionManager = new CommonConnectionManager(
    {}, // Empty ConnectionFactory — backends registered via side-effect imports above
    {
      expandHome: (p: string) =>
        p.replace(/^~/, process.env['HOME'] || '/root'),
      pathToFileURL: (p: string) => pathToFileURL(p),
    }
  );
  connectionManager.setURLReader(urlReader);

  if (globalConfigDir) {
    connectionManager.setGlobalConfigDirectory(globalConfigDir);
  } else if (process.env['MALLOY_GLOBAL_CONFIG_DIR']) {
    connectionManager.setGlobalConfigDirectory(
      process.env['MALLOY_GLOBAL_CONFIG_DIR']
    );
  }

  const logger: TranslateCacheLogger = {
    info: () => {},
    debug: () => {},
    error: (msg: string) => console.error(msg),
  };

  // Create a minimal TextDocuments mock for TranslateCache
  const documentsMap = new Map<string, TextDocument>();
  const documents = {
    get: (uri: string) => documentsMap.get(uri),
    all: () => Array.from(documentsMap.values()),
  } as unknown as TextDocuments<TextDocument>;

  const translateCache = new TranslateCache(
    documents,
    logger,
    connectionManager,
    urlReader
  );

  let hasErrors = false;
  const allDiagnostics: {
    file: string;
    diagnostics: {[uri: string]: Diagnostic[]};
  }[] = [];

  for (const file of files) {
    const absolutePath = path.resolve(file);
    const fileUrl = pathToFileURL(absolutePath);
    const uri = fileUrl.toString();

    let content: string;
    try {
      content = await fs.promises.readFile(absolutePath, 'utf-8');
    } catch (err) {
      console.error(`Error reading file: ${file}: ${err}`);
      hasErrors = true;
      continue;
    }

    // Determine language ID from extension
    const ext = path.extname(file).toLowerCase();
    let languageId = 'malloy';
    if (ext === '.malloysql') {
      languageId = 'malloy-sql';
    } else if (ext === '.malloynb') {
      languageId = 'malloy-notebook';
    }

    const document = TextDocument.create(uri, languageId, 0, content);
    documentsMap.set(uri, document);

    // Set workspace root to file's directory
    connectionManager.setWorkspaceRoots([new URL('./', fileUrl)]);

    try {
      const diagnostics = await getMalloyDiagnostics(translateCache, document);

      allDiagnostics.push({file, diagnostics});

      for (const [diagUri, diags] of Object.entries(diagnostics)) {
        for (const diag of diags) {
          if (diag.severity === DiagnosticSeverity.Error) {
            hasErrors = true;
          }
          if (format === 'text') {
            const displayUri =
              diagUri === uri
                ? file
                : diagUri.startsWith('file://')
                  ? diagUri.replace('file://', '')
                  : diagUri;
            const line = diag.range.start.line + 1;
            const col = diag.range.start.character + 1;
            const sev = severityLabel(diag.severity);
            console.log(
              `${displayUri}:${line}:${col}: ${sev}: ${diag.message}`
            );
          }
        }
      }
    } catch (err) {
      hasErrors = true;
      if (format === 'text') {
        console.error(`${file}: ${err}`);
      }
    }
  }

  if (format === 'json') {
    const output = allDiagnostics.map(({file, diagnostics}) => ({
      file,
      diagnostics: Object.entries(diagnostics).flatMap(([uri, diags]) =>
        diags.map(d => ({
          uri,
          severity: severityLabel(d.severity),
          range: d.range,
          message: d.message,
          code: d.code,
        }))
      ),
    }));
    console.log(JSON.stringify(output, null, 2));
  }

  return hasErrors ? 1 : 0;
}
