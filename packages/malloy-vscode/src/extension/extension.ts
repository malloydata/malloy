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
  runNamedSQLBlock,
  runQueryCommand,
  runQueryFileCommand,
  runUnnamedSQLBlock,
  showLicensesCommand,
} from "./commands";
import { CONNECTION_MANAGER, MALLOY_EXTENSION_STATE } from "./state";
import { ConnectionsProvider } from "./tree_views/connections_view";
import { HelpViewProvider } from "./webview_views/help_view";
import { getNewClientId } from "./utils";
import { trackModelLoad, trackModelSave } from "./telemetry";

let client: LanguageClient;
export let extensionModeProduction: boolean;

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

  // Run named query
  context.subscriptions.push(
    vscode.commands.registerCommand("malloy.runNamedQuery", runNamedQuery)
  );

  // Run named SQL block
  context.subscriptions.push(
    vscode.commands.registerCommand("malloy.runNamedSQLBlock", runNamedSQLBlock)
  );

  // Run unnamed SQL block
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "malloy.runUnnamedSQLBlock",
      runUnnamedSQLBlock
    )
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

  const provider = new HelpViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("malloyHelp", provider)
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("malloy.connections")) {
        await CONNECTION_MANAGER.onConfigurationUpdated();
        connectionsTree.refresh();
      }
    })
  );

  let clientId: string | undefined =
    context.globalState.get("malloy_client_id");
  if (clientId === undefined) {
    clientId = getNewClientId();
    context.globalState.update("malloy_client_id", clientId);
  }
  MALLOY_EXTENSION_STATE.setClientId(clientId);

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async (e) => {
      if (e.languageId === "malloy") {
        trackModelLoad();
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (e) => {
      vscode.commands.executeCommand("malloy.refreshSchema");
      if (e.languageId === "malloy") {
        trackModelSave();
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
