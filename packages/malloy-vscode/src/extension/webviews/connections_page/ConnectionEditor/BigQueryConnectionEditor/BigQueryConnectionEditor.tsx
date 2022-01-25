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
import { BigQueryConnectionConfig } from "../../../../../common/connection_manager_types";
import { TextField, VSCodeButton } from "../../../components";
import { VSCodeCheckbox } from "../../../components/fast";
import { Label } from "../Label";
import { LabelCell } from "../LabelCell";

interface BigQueryConnectionEditorProps {
  config: BigQueryConnectionConfig;
  setConfig: (config: BigQueryConnectionConfig) => void;
  requestServiceAccountKeyPath: () => void;
}

export const BigQueryConnectionEditor: React.FC<BigQueryConnectionEditorProps> =
  ({ config, setConfig, requestServiceAccountKeyPath }) => {
    return (
      <table>
        <tbody>
          <tr>
            <LabelCell>
              <Label>Name:</Label>
            </LabelCell>
            <td>
              <TextField
                value={config.name}
                setValue={(name) => {
                  setConfig({ ...config, name });
                }}
              />
            </td>
          </tr>
          <tr>
            <LabelCell>
              <Label>Project Name:</Label>
            </LabelCell>
            <td>
              <TextField
                value={config.projectName || ""}
                setValue={(projectName) => {
                  setConfig({ ...config, projectName });
                }}
                placeholder="Optional"
              />
            </td>
          </tr>
          <tr>
            <LabelCell>
              <Label>Location:</Label>
            </LabelCell>
            <td>
              <TextField
                value={config.location || ""}
                setValue={(location) => {
                  setConfig({ ...config, location });
                }}
                placeholder="Optional (default US)"
              />
            </td>
          </tr>
          <tr>
            <LabelCell></LabelCell>
            <td colSpan={2}>
              <VSCodeCheckbox
                checked={config.serviceAccountKeyPath !== undefined}
                onChange={(event) => {
                  const checked = (event.target as any).checked;
                  setConfig({ ...config, serviceAccountKeyPath: checked ? "" : undefined });
                }}
              >
                Specify Service Account Key
              </VSCodeCheckbox>
            </td>
          </tr>
          {config.serviceAccountKeyPath !== undefined && (
            <tr>
              <LabelCell>
                <Label>Service Account Key File Path:</Label>
              </LabelCell>
              <td>
                <TextField
                  value={config.serviceAccountKeyPath || ""}
                  setValue={(serviceAccountKeyPath) => {
                    setConfig({ ...config, serviceAccountKeyPath });
                  }}
                />
              </td>
              <td>
                <VSCodeButton
                  onClick={requestServiceAccountKeyPath}
                  style={{ height: "25px" }}
                >
                  Pick File
                </VSCodeButton>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  };
