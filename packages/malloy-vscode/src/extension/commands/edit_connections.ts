/*
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as vscode from "vscode";
import * as path from "path";
import { getWebviewHtml } from "../webviews";
import {
  ConnectionMessageType,
  ConnectionPanelMessage,
  ConnectionServiceAccountKeyRequestStatus,
  ConnectionTestStatus,
  WebviewMessageManager,
} from "../webview_message_manager";
import { CONNECTION_MANAGER, getConnectionsConfig } from "../state";
import { ConnectionBackend, ConnectionConfig } from "../../common";
import { setPassword } from "keytar";

export function editConnectionsCommand(): void {
  const panel = vscode.window.createWebviewPanel(
    "malloyConnections",
    "Edit Connections",
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  const onDiskPath = vscode.Uri.file(
    path.join(__filename, "..", "connections_webview.js")
  );

  const entrySrc = panel.webview.asWebviewUri(onDiskPath);

  panel.webview.html = getWebviewHtml(entrySrc.toString());

  const messageManager = new WebviewMessageManager<ConnectionPanelMessage>(
    panel
  );

  const connections = getConnectionsConfig();

  messageManager.postMessage({
    type: ConnectionMessageType.SetConnections,
    connections,
  });

  messageManager.onReceiveMessage(async (message) => {
    switch (message.type) {
      case ConnectionMessageType.SetConnections: {
        const connections = await handleConnectionsPreSave(message.connections);
        vscode.workspace
          .getConfiguration("malloy")
          .update("connections", connections);
        messageManager.postMessage({
          type: ConnectionMessageType.SetConnections,
          connections,
        });
        break;
      }
      case ConnectionMessageType.TestConnection: {
        try {
          const connection = await CONNECTION_MANAGER.connectionForConfig(
            message.connection
          );
          await connection.test();
          messageManager.postMessage({
            type: ConnectionMessageType.TestConnection,
            status: ConnectionTestStatus.Success,
            connection: message.connection,
          });
        } catch (error) {
          messageManager.postMessage({
            type: ConnectionMessageType.TestConnection,
            status: ConnectionTestStatus.Error,
            connection: message.connection,
            error: error.toString(),
          });
        }
        break;
      }
      case ConnectionMessageType.RequestBigQueryServiceAccountKeyFile: {
        const result = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: {
            JSON: ["json"],
          },
        });
        if (result) {
          messageManager.postMessage({
            type: ConnectionMessageType.RequestBigQueryServiceAccountKeyFile,
            status: ConnectionServiceAccountKeyRequestStatus.Success,
            connectionId: message.connectionId,
            serviceAccountKeyPath: result[0].fsPath,
          });
        }
        break;
      }
    }
  });
}

async function handleConnectionsPreSave(
  connections: ConnectionConfig[]
): Promise<ConnectionConfig[]> {
  const modifiedConnections = [];
  for (const connection of connections) {
    if (
      connection.backend === ConnectionBackend.Postgres &&
      connection.password !== undefined &&
      connection.password !== ""
    ) {
      modifiedConnections.push({
        ...connection,
        password: undefined,
        useKeychainPassword: true,
      });
      await setPassword(
        "com.malloy-lang.vscode-extension",
        `connections.${connection.id}.password`,
        connection.password
      );
    } else {
      modifiedConnections.push(connection);
    }
  }
  return modifiedConnections;
}
