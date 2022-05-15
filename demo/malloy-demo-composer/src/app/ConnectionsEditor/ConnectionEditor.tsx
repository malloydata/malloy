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

import { useState } from "react";
import { ConnectionBackend, ConnectionConfig } from "../../types";
import { FormFieldList, FormInputLabel } from "../CommonElements";
import { SelectDropdown } from "../SelectDropdown";
import { BigQueryConnectionEditor } from "./BigQueryConnectionEditor";
import { PostgresConnectionEditor } from "./PostgresConnectionEditor";

interface ConnectionEditorProps {
  config: ConnectionConfig;
  setConfig: (config: ConnectionConfig) => void;
}

export const ConnectionEditor: React.FC<ConnectionEditorProps> = ({
  config,
  setConfig,
}) => {
  return (
    <div>
      <FormFieldList>
        <FormInputLabel>Backend</FormInputLabel>
        <SelectDropdown
          value={config.backend}
          options={[
            { label: "BigQuery", value: "bigquery" },
            { label: "Postgres", value: "postgres" },
          ]}
          onChange={(backend) => {
            setConfig({
              name: config.name,
              backend: backend as ConnectionBackend,
              id: config.id,
              isDefault: config.isDefault,
            });
          }}
        />
        {config.backend === ConnectionBackend.BigQuery ? (
          <BigQueryConnectionEditor
            config={config}
            setConfig={setConfig}
            requestServiceAccountKeyPath={() => {
              /* do nothing */
            }}
          />
        ) : (
          <PostgresConnectionEditor config={config} setConfig={setConfig} />
        )}
      </FormFieldList>
    </div>
  );
};
