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
import { BigQueryConnectionConfig } from "../../../../../common/connection_manager_types";

interface BigQueryConnectionEditorProps {
  config: BigQueryConnectionConfig;
  setConfig: (config: BigQueryConnectionConfig) => void;
  requestServiceAccountKeyPath: () => void;
}

export const BigQueryConnectionEditor: React.FC<BigQueryConnectionEditorProps> =
  ({ config, setConfig, requestServiceAccountKeyPath }) => {
    return (
      <div>
        <div>
          Name:
          <input
            value={config.name}
            onChange={(e) => {
              setConfig({ ...config, name: e.target.value });
            }}
          ></input>
        </div>
        <div>
          Project Name:
          <input
            value={config.projectName}
            onChange={(e) => {
              setConfig({ ...config, projectName: e.target.value });
            }}
            placeholder="Optional"
          ></input>
        </div>
        <div>
          Location:
          <input
            value={config.location}
            onChange={(e) => {
              setConfig({ ...config, location: e.target.value });
            }}
            placeholder="Optional (default US)"
          ></input>
        </div>
        <div>
          Service Account Key File Path:
          <input
            value={config.serviceAccountKeyPath}
            onChange={(e) => {
              setConfig({ ...config, serviceAccountKeyPath: e.target.value });
            }}
            placeholder="Optional"
          ></input>
          <button onClick={requestServiceAccountKeyPath}>Pick File</button>
        </div>
      </div>
    );
  };
