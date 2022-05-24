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
import { DuckDBConnectionConfig } from "../../../../../common/connection_manager_types";
import { TextField, VSCodeButton } from "../../../components";
import { Label } from "../Label";
import { LabelCell } from "../LabelCell";

interface DuckDBConnectionEditorProps {
  config: DuckDBConnectionConfig;
  setConfig: (config: DuckDBConnectionConfig) => void;
}

export const DuckDBConnectionEditor: React.FC<DuckDBConnectionEditorProps> = ({
  config,
  setConfig,
}) => {
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
            <Label>Database Path:</Label>
          </LabelCell>
          <td>
            <TextField
              value={config.databasePath || ""}
              setValue={(databasePath) => {
                setConfig({ ...config, databasePath });
              }}
            />
          </td>
        </tr>
      </tbody>
    </table>
  );
};
