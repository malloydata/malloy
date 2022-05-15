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

import React from "react";
import { BigQueryConnectionConfig } from "../../types";
import { CodeInput } from "../CodeInput";
import { Button, FormInputLabel } from "../CommonElements";

interface BigQueryConnectionEditorProps {
  config: BigQueryConnectionConfig;
  setConfig: (config: BigQueryConnectionConfig) => void;
  requestServiceAccountKeyPath: () => void;
}

export const BigQueryConnectionEditor: React.FC<BigQueryConnectionEditorProps> =
  ({ config, setConfig, requestServiceAccountKeyPath }) => {
    return (
      <>
        <CodeInput
          value={config.name}
          setValue={(name) => {
            setConfig({ ...config, name });
          }}
          label="Name"
        />
        <CodeInput
          value={config.projectName || ""}
          setValue={(projectName) => {
            setConfig({ ...config, projectName });
          }}
          placeholder="Optional"
          label="Project Name"
        />
        <CodeInput
          value={config.location || ""}
          setValue={(location) => {
            setConfig({ ...config, location });
          }}
          placeholder="Optional (default US)"
          label="Location"
        />
        <CodeInput
          value={config.serviceAccountKeyPath || ""}
          setValue={(serviceAccountKeyPath) => {
            setConfig({ ...config, serviceAccountKeyPath });
          }}
          placeholder="Optional"
          label="Service Account Key File Path"
        />
        <Button
          onClick={requestServiceAccountKeyPath}
          style={{ height: "25px" }}
        >
          Pick File
        </Button>
      </>
    );
  };
