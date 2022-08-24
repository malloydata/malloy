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

import React from "react";
import styled from "styled-components";
import {
  ConnectionBackend,
  ConnectionConfig,
} from "../../../../common/connection_manager_types";
import { ConnectionMessageTest } from "../../../message_types";
import { Dropdown } from "../../components";
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeTag,
} from "@vscode/webview-ui-toolkit/react";
import { ButtonGroup } from "../ButtonGroup";
import { BigQueryConnectionEditor } from "./BigQueryConnectionEditor";
import { Label } from "./Label";
import { LabelCell } from "./LabelCell";
import { PostgresConnectionEditor } from "./PostgresConnectionEditor";
import { DuckDBConnectionEditor } from "./DuckDBConnectionEditor";
import { isDuckDBAvailable } from "../../../../common/duckdb_availability";

interface ConnectionEditorProps {
  config: ConnectionConfig;
  setConfig: (config: ConnectionConfig) => void;
  deleteConfig: () => void;
  testConfig: () => void;
  testStatus: ConnectionMessageTest | undefined;
  requestServiceAccountKeyPath: (connectionId: string) => void;
  isDefault: boolean;
  makeDefault: () => void;
}

export const ConnectionEditor: React.FC<ConnectionEditorProps> = ({
  config,
  setConfig,
  deleteConfig,
  testConfig,
  testStatus,
  requestServiceAccountKeyPath,
  isDefault,
  makeDefault,
}) => {
  const backendOptions: { value: ConnectionBackend; label: string }[] = [
    { value: ConnectionBackend.BigQuery, label: "BigQuery" },
    { value: ConnectionBackend.Postgres, label: "Postgres" },
  ];

  if (isDuckDBAvailable) {
    backendOptions.push({ value: ConnectionBackend.DuckDB, label: "DuckDB" });
  }

  return (
    <ConnectionEditorBox>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          justifyContent: "space-between",
        }}
      >
        <ConnectionTitle>CONNECTION</ConnectionTitle>
        {isDefault && <VSCodeTag>Default</VSCodeTag>}
        {!isDefault && (
          <VSCodeButton onClick={makeDefault} style={{ height: "25px" }}>
            Make Default
          </VSCodeButton>
        )}
      </div>
      <table>
        <tbody>
          <tr>
            <LabelCell>
              <Label>Type:</Label>
            </LabelCell>
            <td>
              <Dropdown
                value={config.backend}
                setValue={(backend: string) =>
                  setConfig({
                    name: config.name,
                    backend: backend as ConnectionBackend,
                    id: config.id,
                    isDefault: config.isDefault,
                  })
                }
                options={backendOptions}
              />
            </td>
          </tr>
        </tbody>
      </table>
      {config.backend === ConnectionBackend.BigQuery ? (
        <BigQueryConnectionEditor
          config={config}
          setConfig={setConfig}
          requestServiceAccountKeyPath={() =>
            requestServiceAccountKeyPath(config.id)
          }
        />
      ) : config.backend === ConnectionBackend.Postgres ? (
        <PostgresConnectionEditor config={config} setConfig={setConfig} />
      ) : (
        <DuckDBConnectionEditor config={config} setConfig={setConfig} />
      )}
      <VSCodeDivider />
      <table>
        <tbody>
          <tr>
            <LabelCell></LabelCell>
            <td>
              <ButtonGroup style={{ marginTop: "5px" }}>
                <VSCodeButton onClick={deleteConfig} appearance="secondary">
                  Delete
                </VSCodeButton>
                <VSCodeButton onClick={testConfig}>Test</VSCodeButton>
                {testStatus && <VSCodeTag>{testStatus?.status}</VSCodeTag>}
                {testStatus?.status === "error" && testStatus.error}
              </ButtonGroup>
            </td>
          </tr>
        </tbody>
      </table>
    </ConnectionEditorBox>
  );
};

const ConnectionEditorBox = styled.div`
  margin: 10px;
  background-color: var(--vscode-list-hoverBackground);
  padding: 10px;
  border: 1px solid var(--vscode-contrastBorder);
`;

const ConnectionTitle = styled.b`
  color: var(--foreground);
  font-family: var(--font-family);
`;
