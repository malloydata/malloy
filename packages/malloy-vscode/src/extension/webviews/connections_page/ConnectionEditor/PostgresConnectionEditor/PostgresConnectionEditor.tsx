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

import { TextFieldType } from "@vscode/webview-ui-toolkit";
import React, { useState } from "react";
import { PostgresConnectionConfig } from "../../../../../common/connection_manager_types";
import { TextField } from "../../../components";
import { VSCodeCheckbox, VSCodeRadio } from "../../../components/fast";
import { Label } from "../Label";
import { LabelCell } from "../LabelCell";

interface PostgresConnectionEditorProps {
  config: PostgresConnectionConfig;
  setConfig: (config: PostgresConnectionConfig) => void;
}

export const PostgresConnectionEditor: React.FC<PostgresConnectionEditorProps> =
  ({ config, setConfig }) => {
    const [showPassword, setShowPassword] = useState(false);
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
              <Label>Host:</Label>
            </LabelCell>
            <td>
              <TextField
                value={config.host || ""}
                setValue={(host) => {
                  setConfig({ ...config, host });
                }}
              ></TextField>
            </td>
          </tr>
          <tr>
            <LabelCell>
              <Label>Port:</Label>
            </LabelCell>
            <td>
              <TextField
                value={config.port ? config.port.toString() : ""}
                setValue={(port) => {
                  setConfig({ ...config, port: parseInt(port) });
                }}
              ></TextField>
            </td>
          </tr>
          <tr>
            <LabelCell>
              <Label>Database Name:</Label>
            </LabelCell>
            <td>
              <TextField
                value={config.databaseName || ""}
                setValue={(databaseName) => {
                  setConfig({ ...config, databaseName });
                }}
              ></TextField>
            </td>
          </tr>
          <tr>
            <LabelCell>
              <Label>Username:</Label>
            </LabelCell>
            <td>
              <TextField
                value={config.username || ""}
                setValue={(username) => {
                  setConfig({ ...config, username });
                }}
              />
            </td>
          </tr>
          <tr>
            <LabelCell>
              <Label>Password:</Label>
            </LabelCell>
            <td>
              {config.useKeychainPassword !== undefined && (
                <div>
                  <VSCodeRadio
                    value="keychain"
                    checked={config.useKeychainPassword}
                    onChange={(event) => {
                      if (event?.target && (event?.target as any).checked) {
                        setConfig({
                          ...config,
                          password: undefined,
                          useKeychainPassword: true,
                        });
                      }
                    }}
                  >
                    Use existing value
                  </VSCodeRadio>
                </div>
              )}
              <div>
                <VSCodeRadio
                  value="none"
                  key="none"
                  checked={
                    !config.useKeychainPassword && config.password === undefined
                  }
                  onChange={(event) => {
                    if (event?.target && (event?.target as any).checked) {
                      setConfig({
                        ...config,
                        password: undefined,
                        useKeychainPassword:
                          config.useKeychainPassword === undefined
                            ? undefined
                            : false,
                      });
                    }
                  }}
                >
                  No password
                </VSCodeRadio>
              </div>
              <div>
                <VSCodeRadio
                  value="specified"
                  key="specified"
                  checked={config.password !== undefined}
                  onChange={(event) => {
                    if (event?.target && (event?.target as any).checked) {
                      setConfig({
                        ...config,
                        password: "",
                        useKeychainPassword:
                          config.useKeychainPassword === undefined
                            ? undefined
                            : false,
                      });
                    }
                  }}
                >
                  Enter a password
                  {config.password !== undefined && ":"}
                </VSCodeRadio>
              </div>
            </td>
          </tr>
          {config.password !== undefined && (
            <tr>
              <td></td>
              <td>
                <TextField
                  value={config.password}
                  setValue={(password) => {
                    setConfig({
                      ...config,
                      password,
                    });
                  }}
                  type={
                    showPassword ? TextFieldType.text : TextFieldType.password
                  }
                  placeholder="Optional"
                />
              </td>
              <td style={{ paddingLeft: "10px" }}>
                <VSCodeCheckbox
                  checked={showPassword}
                  onChange={(event) => {
                    setShowPassword((event.target as any).checked);
                  }}
                >
                  Show Password
                </VSCodeCheckbox>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );
  };
