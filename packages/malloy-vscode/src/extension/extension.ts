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

import * as vscode from "vscode";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import {
  runTurtleFromSchemaCommand,
  SchemaProvider,
} from "./tree_views/schema_view";
import {
  copyFieldPathCommand,
  editConnectionsCommand,
  runNamedQuery,
  runQueryCommand,
  runQueryFileCommand,
  runQueryWithEdit,
  showLicensesCommand,
} from "./commands";
import { CONNECTION_MANAGER, getConnectionsConfig } from "./state";
import { ConnectionsProvider } from "./tree_views/connections_view";

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext): void {
  // Show Licenses
  context.subscriptions.push(
    vscode.commands.registerCommand("malloy.showLicenses", showLicensesCommand)
  );

  // Run Query (whole file)
  context.subscriptions.push(
    vscode.commands.registerCommand("malloy.runQueryFile", runQueryFileCommand)
  );

  // Run query
  context.subscriptions.push(
    vscode.commands.registerCommand("malloy.runQuery", runQueryCommand)
  );

  // Run query with filters
  context.subscriptions.push(
    vscode.commands.registerCommand("malloy.runQueryWithEdit", runQueryWithEdit)
  );

  // Run named query
  context.subscriptions.push(
    vscode.commands.registerCommand("malloy.runNamedQuery", runNamedQuery)
  );

  // Copy Field Path
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "malloy.copyFieldPath",
      copyFieldPathCommand
    )
  );

  const schemaTree = new SchemaProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("malloySchema", schemaTree)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("malloy.refreshSchema", () =>
      schemaTree.refresh()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "malloy.runTurtleFromSchema",
      runTurtleFromSchemaCommand
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(() => {
      vscode.commands.executeCommand("malloy.refreshSchema");
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() =>
      vscode.commands.executeCommand("malloy.refreshSchema")
    )
  );

  const connectionsTree = new ConnectionsProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("malloyConnections", connectionsTree)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "malloy.editConnections",
      editConnectionsCommand
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("malloy.connections")) {
        await CONNECTION_MANAGER.setConnectionsConfig(getConnectionsConfig());
        connectionsTree.refresh();
      }
    })
  );

  setupLanguageServer(context);
}

export function deactivate(): Promise<void> | undefined {
  if (client) {
    // TODO can this just be put into a disposable, passed to `context.subscriptions.push`
    //      and disposed automatically?
    return client.stop();
  }
}

function setupLanguageServer(context: vscode.ExtensionContext): void {
  const serverModule = context.asAbsolutePath("dist/server.js");
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "malloy" }],
    synchronize: {
      configurationSection: "malloy",
      fileEvents: vscode.workspace.createFileSystemWatcher("**/.clientrc"),
    },
  };

  client = new LanguageClient(
    "malloy",
    "Malloy Language Server",
    serverOptions,
    clientOptions
  );

  client.start();
}
