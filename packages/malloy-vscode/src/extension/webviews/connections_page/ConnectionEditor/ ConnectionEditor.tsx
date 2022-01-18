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
import styled from "styled-components";
import {
  ConnectionBackend,
  ConnectionConfig,
} from "../../../../common/connection_manager_types";
import { ConnectionMessageTest } from "../../../webview_message_manager";
import { BigQueryConnectionEditor } from "./BigQueryConnectionEditor";
import { PostgresConnectionEditor } from "./PostgresConnectionEditor";

interface ConnectionEditorProps {
  config: ConnectionConfig;
  setConfig: (config: ConnectionConfig) => void;
  deleteConfig: () => void;
  testConfig: () => void;
  testStatus: ConnectionMessageTest | undefined;
  requestServiceAccountKeyPath: (connectionId: string) => void;
}

export const ConnectionEditor: React.FC<ConnectionEditorProps> = ({
  config,
  setConfig,
  deleteConfig,
  testConfig,
  testStatus,
  requestServiceAccountKeyPath,
}) => {
  return (
    <ConnectionEditorBox>
      Type:
      <select
        value={config.backend}
        onChange={(event) =>
          setConfig({
            name: config.name,
            backend: event.target.value as ConnectionBackend,
            id: config.id,
          })
        }
      >
        <option value={ConnectionBackend.BigQuery} key="bq">
          BigQuery
        </option>
        <option value={ConnectionBackend.Postgres} key="pg">
          Postgres
        </option>
      </select>
      {config.backend === ConnectionBackend.BigQuery ? (
        <BigQueryConnectionEditor
          config={config}
          setConfig={setConfig}
          requestServiceAccountKeyPath={() =>
            requestServiceAccountKeyPath(config.id)
          }
        />
      ) : (
        <PostgresConnectionEditor config={config} setConfig={setConfig} />
      )}
      <button onClick={deleteConfig}>Delete</button>
      <button onClick={testConfig}>Test</button>
      Test Status: {testStatus?.status}
      {testStatus?.status === "error" && testStatus.error}
    </ConnectionEditorBox>
  );
};

const ConnectionEditorBox = styled.div`
  margin: 10px;
  background-color: #e6e6e6;
  padding: 10px;
`;
