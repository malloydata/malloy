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

  const [connections, setConnections] = useState<
    ConnectionConfig[] | undefined
  >();
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
              (connections || []).map((connection) => {
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
    <div>
      {connections !== undefined && (
        <ConnectionEditorList
          connections={connections}
          setConnections={setConnections}
          saveConnections={postConnections}
          testConnection={testConnection}
          testStatuses={testStatuses}
          requestServiceAccountKeyPath={requestServiceAccountKeyPath}
        />
      )}
    </div>
  );
};
