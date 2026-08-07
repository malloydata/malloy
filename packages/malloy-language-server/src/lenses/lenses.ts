/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  CodeLens,
  Connection,
  Position,
  Range,
} from 'vscode-languageserver';
import type {TextDocument} from 'vscode-languageserver-textdocument';
import {parseWithCache} from '../parse_cache';
import type {ConnectionManager} from '../common/types/connection_manager_types';
import {getSourceUrl, unquoteIdentifier} from './utils';
import type {DocumentMetadata} from '../common/types/query_spec';

const fixNotebookUrl = async (connection: Connection, url: URL) => {
  if (url.protocol === 'vscode-notebook-cell:') {
    let protocol = 'file:';
    const workspaceFolders = await connection.workspace.getWorkspaceFolders();
    if (workspaceFolders && workspaceFolders[0]) {
      protocol = new URL(workspaceFolders[0].uri).protocol;
    }
    const {pathname, search} = url;
    const host = protocol === 'file:' ? '' : url.host;
    const urlString = `${protocol}//${host}${pathname}${search}`;
    url = new URL(urlString);
  }

  return url;
};

export async function getMalloyLenses(
  connection: Connection,
  document: TextDocument,
  connectionManager: ConnectionManager
): Promise<CodeLens[]> {
  const lenses: CodeLens[] = [];
  const parse = parseWithCache(document);
  const symbols = parse.symbols;
  const connectionLookup = await connectionManager.getConnectionLookup(
    new URL(document.uri)
  );

  const tablepaths = parse.tablePathInfo;
  let externalPreview = tablepaths.length ? false : true;
  for (const table of tablepaths) {
    const conn = await connectionLookup.lookupConnection(table.connectionId);
    const tableUrl = await getSourceUrl(table.tablePath, conn);
    if (tableUrl) {
      lenses.push({
        range: table.range,
        command: {
          title: 'Table',
          command: 'malloy.openUrlInBrowser',
          arguments: [tableUrl],
        },
      });
      externalPreview = true;
    }
  }

  let currentUnnamedQueryIndex = 0;
  for (const symbol of symbols) {
    switch (symbol.type) {
      case 'query':
        lenses.push(
          {
            range: symbol.lensRange.toJSON(),
            command: {
              title: 'Run',
              command: 'malloy.runNamedQuery',
              arguments: [symbol.name],
            },
          },
          {
            range: symbol.lensRange.toJSON(),
            command: {
              title: 'Show SQL',
              command: 'malloy.showSQLNamedQuery',
              arguments: [symbol.name],
            },
          }
        );
        break;
      case 'unnamed_query':
        lenses.push(
          {
            range: symbol.lensRange.toJSON(),
            command: {
              title: 'Run',
              command: 'malloy.runQueryFile',
              arguments: [currentUnnamedQueryIndex],
            },
          },
          {
            range: symbol.lensRange.toJSON(),
            command: {
              title: 'Show SQL',
              command: 'malloy.showSQLFile',
              arguments: [currentUnnamedQueryIndex],
            },
          }
        );
        currentUnnamedQueryIndex++;
        break;
      case 'explore':
        {
          const children = symbol.children;
          const exploreName = symbol.name;
          lenses.push({
            range: symbol.lensRange.toJSON(),
            command: {
              title: 'Schema',
              command: 'malloy.showSchema',
              arguments: [unquoteIdentifier(exploreName)],
            },
          });
          lenses.push({
            range: symbol.lensRange.toJSON(),
            command: {
              title: 'Explore',
              command: 'malloy.openComposer',
              arguments: [unquoteIdentifier(exploreName)],
            },
          });
          if (!externalPreview) {
            lenses.push({
              range: symbol.lensRange.toJSON(),
              command: {
                title: 'Preview',
                command: 'malloy.runQuery',
                arguments: [
                  `run: ${exploreName}->{ select: *; limit: 20 }`,
                  `Preview: ${exploreName}`,
                  'preview',
                ],
              },
            });
          }
          children.forEach(child => {
            if (child.type === 'query') {
              const queryName = child.name;
              lenses.push(
                {
                  range: child.lensRange.toJSON(),
                  command: {
                    title: 'Run',
                    command: 'malloy.runQuery',
                    arguments: [
                      `run: ${exploreName}->${queryName}`,
                      `${exploreName}->${queryName}`,
                    ],
                  },
                },
                {
                  range: child.lensRange.toJSON(),
                  command: {
                    title: 'Show SQL',
                    command: 'malloy.showSQL',
                    arguments: [
                      `run: ${exploreName}->${queryName}`,
                      `${exploreName}->${queryName}`,
                    ],
                  },
                },
                {
                  range: child.lensRange.toJSON(),
                  command: {
                    title: 'Explore',
                    command: 'malloy.openComposer',
                    arguments: [unquoteIdentifier(exploreName), queryName],
                  },
                }
              );
            }
          });
        }
        break;
      case 'import':
        try {
          const documentUrl = new URL(document.uri);
          const url = await fixNotebookUrl(
            connection,
            new URL(symbol.name, documentUrl)
          );
          lenses.push({
            range: symbol.lensRange.toJSON(),
            command: {
              title: 'Schemas: all',
              command: 'malloy.showSchemaFile',
              arguments: [url.toString()],
            },
          });
          for (const child of symbol.children) {
            lenses.push({
              range: child.lensRange.toJSON(),
              command: {
                title: child.name,
                command: 'malloy.showSchema',
                arguments: [child.name],
              },
            });
          }
          symbol.children.forEach((child, idx) => {
            const documentMeta: DocumentMetadata = {
              uri: url.toString(),
              fileName: url.pathname,
              languageId: 'malloy',
              version: 0,
            };
            lenses.push({
              range: child.lensRange.toJSON(),
              command: {
                title: idx === 0 ? `Explore: ${child.name}` : child.name,
                command: 'malloy.openComposer',
                arguments: [
                  unquoteIdentifier(child.name),
                  undefined,
                  undefined,
                  documentMeta,
                ],
              },
            });
          });
        } catch (e) {
          console.error('import code lens failed with', e);
        }
        break;
    }
  }

  return lenses;
}

function inRange(range: Range, position: Position): boolean {
  const {start, end} = range;
  const afterStart =
    position.line > start.line ||
    (position.line === start.line && position.character >= start.character);
  const beforeEnd =
    position.line < end.line ||
    (position.line === end.line && position.character <= end.character);
  return afterStart && beforeEnd;
}

export async function findMalloyLensesAt(
  connection: Connection,
  document: TextDocument,
  position: Position,
  connectionManager: ConnectionManager
): Promise<CodeLens[]> {
  const lenses = await getMalloyLenses(connection, document, connectionManager);

  return lenses.filter(lens => inRange(lens.range, position));
}
