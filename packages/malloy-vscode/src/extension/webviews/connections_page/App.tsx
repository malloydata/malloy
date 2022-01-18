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

import React, { useEffect, useState } from "react";
import { ConnectionConfig } from "../../../common";
import {
  ConnectionMessageType,
  ConnectionPanelMessage,
  ConnectionMessageTest,
  ConnectionTestStatus,
  ConnectionServiceAccountKeyRequestStatus,
  QueryPanelMessage,
} from "../../webview_message_manager";
import { useVSCodeContext } from "../vscode_context";
import { ConnectionEditorList } from "./ConnectionEditorList";

export const App: React.FC = () => {
  const vscode = useVSCodeContext();
  useEffect(() => {
    vscode.postMessage({ type: "app-ready" } as QueryPanelMessage);
  });

  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [testStatuses, setTestStatuses] = useState<ConnectionMessageTest[]>([]);

  const postConnections = () => {
    vscode.postMessage({ type: "set-connections", connections });
  };

  const testConnection = (connection: ConnectionConfig) => {
    const message: ConnectionMessageTest = {
      type: ConnectionMessageType.TestConnection,
      connection,
      status: ConnectionTestStatus.Waiting,
    };
    vscode.postMessage(message);
    setTestStatuses([...testStatuses, message]);
  };

  const requestServiceAccountKeyPath = (connectionId: string) => {
    vscode.postMessage({
      type: ConnectionMessageType.RequestBigQueryServiceAccountKeyFile,
      connectionId,
      status: ConnectionServiceAccountKeyRequestStatus.Waiting,
    });
  };

  useEffect(() => {
    const listener = (event: MessageEvent<ConnectionPanelMessage>) => {
      const message = event.data;

      switch (message.type) {
        case ConnectionMessageType.SetConnections:
          setConnections(message.connections);
          break;
        case ConnectionMessageType.TestConnection:
          setTestStatuses([...testStatuses, message]);
          break;
        case ConnectionMessageType.RequestBigQueryServiceAccountKeyFile: {
          if (
            message.status === ConnectionServiceAccountKeyRequestStatus.Success
          ) {
            setConnections(
              connections.map((connection) => {
                if (connection.id === message.connectionId) {
                  return {
                    ...connection,
                    serviceAccountKeyPath: message.serviceAccountKeyPath,
                  };
                } else {
                  return connection;
                }
              })
            );
          }
          break;
        }
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  });

  return (
    <ConnectionEditorList
      connections={connections}
      setConnections={setConnections}
      saveConnections={postConnections}
      testConnection={testConnection}
      testStatuses={testStatuses}
      requestServiceAccountKeyPath={requestServiceAccountKeyPath}
    />
  );
};
