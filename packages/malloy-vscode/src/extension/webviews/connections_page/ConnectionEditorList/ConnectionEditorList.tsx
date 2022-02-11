/*
 * Copyright 2022 Google LLC
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

import React, { useState } from "react";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";
import {
  ConnectionBackend,
  ConnectionConfig,
  getDefaultIndex,
} from "../../../../common/connection_manager_types";
import { ConnectionMessageTest } from "../../../webview_message_manager";
import { VSCodeButton } from "../../components";
import { ButtonGroup } from "../ButtonGroup";
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
  const [dirty, setDirty] = useState(false);
  const defaultConnectionIndex = getDefaultIndex(connections);

  const addConnection = () => {
    setConnections([
      ...connections,
      {
        name: "",
        backend: ConnectionBackend.BigQuery,
        id: uuidv4(),
        isDefault: connections.length === 0,
      },
    ]);
  };

  const setConfig = (config: ConnectionConfig, index: number) => {
    const copy = [...connections];
    copy[index] = config;
    setConnections(copy);
    setDirty(true);
  };

  const makeDefault = (defaultIndex: number) => {
    const newConnections = connections.map((connection, index) => {
      return { ...connection, isDefault: index === defaultIndex };
    });
    setConnections(newConnections);
    setDirty(true);
  };

  return (
    <div style={{ marginTop: "20px" }}>
      <ButtonGroup style={{ margin: "10px" }}>
        <VSCodeButton onClick={addConnection}>New Connection</VSCodeButton>
      </ButtonGroup>
      {connections.map((config, index) => (
        <ConnectionEditor
          key={index}
          config={config}
          setConfig={(newConfig) => setConfig(newConfig, index)}
          deleteConfig={() => {
            const copy = [...connections];
            copy.splice(index, 1);
            setConnections(copy);
            setDirty(true);
          }}
          testConfig={() => {
            testConnection(connections[index]);
          }}
          testStatus={[...testStatuses]
            .reverse()
            .find((message) => message.connection.id === config.id)}
          requestServiceAccountKeyPath={requestServiceAccountKeyPath}
          isDefault={index === defaultConnectionIndex}
          makeDefault={() => makeDefault(index)}
        />
      ))}
      {connections.length === 0 && (
        <EmptyStateBox>NO CONNECTIONS</EmptyStateBox>
      )}
      {dirty && (
        <ButtonGroup style={{ margin: "10px" }}>
          <VSCodeButton
            onClick={() => {
              setDirty(false);
              saveConnections();
            }}
          >
            Save
          </VSCodeButton>
        </ButtonGroup>
      )}
    </div>
  );
};

const EmptyStateBox = styled.div`
  margin: 10px;
  background-color: var(--vscode-list-hoverBackground);
  padding: 10px;
  border: 1px solid var(--vscode-contrastBorder);
  color: var(--foreground);
  font-family: var(--font-family);
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
`;
