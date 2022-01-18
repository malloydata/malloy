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

import React from "react";
import { v4 as uuidv4 } from "uuid";
import {
  ConnectionBackend,
  ConnectionConfig,
} from "../../../../common/connection_manager_types";
import { ConnectionMessageTest } from "../../../webview_message_manager";
import { ConnectionEditor } from "../ConnectionEditor";

interface ConnectionEditorListProps {
  connections: ConnectionConfig[];
  setConnections: (connections: ConnectionConfig[]) => void;
  saveConnections: () => void;
  testConnection: (connection: ConnectionConfig) => void;
  testStatuses: ConnectionMessageTest[];
  requestServiceAccountKeyPath: (connectionId: string) => void;
}

export const ConnectionEditorList: React.FC<ConnectionEditorListProps> = ({
  connections,
  setConnections,
  saveConnections,
  testConnection,
  testStatuses,
  requestServiceAccountKeyPath,
}) => {
  const addConnection = () => {
    setConnections([
      ...connections,
      { name: "", backend: ConnectionBackend.BigQuery, id: uuidv4() },
    ]);
  };

  return (
    <div>
      {connections.map((config, index) => (
        <ConnectionEditor
          key={index}
          config={config}
          setConfig={(config: ConnectionConfig) => {
            const copy = [...connections];
            copy[index] = config;
            setConnections(copy);
          }}
          deleteConfig={() => {
            const copy = [...connections];
            copy.splice(index, 1);
            setConnections(copy);
          }}
          testConfig={() => {
            testConnection(connections[index]);
          }}
          testStatus={[...testStatuses]
            .reverse()
            .find((message) => message.connection.id === config.id)}
          requestServiceAccountKeyPath={requestServiceAccountKeyPath}
        />
      ))}
      <button onClick={addConnection} key="new">
        New Connection
      </button>
      <button onClick={saveConnections} key="save">
        Save Connections
      </button>
    </div>
  );
};
