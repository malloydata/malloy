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
import { PostgresConnectionConfig } from "../../types";
import { CodeInput } from "../CodeInput";
import { FormInputLabel } from "../CommonElements";
import { SelectList } from "../SelectDropdown/SelectDropdown";
import { notUndefined } from "../utils";

interface PostgresConnectionEditorProps {
  config: PostgresConnectionConfig;
  setConfig: (config: PostgresConnectionConfig) => void;
}

export const PostgresConnectionEditor: React.FC<PostgresConnectionEditorProps> =
  ({ config, setConfig }) => {
    const [showPassword, setShowPassword] = useState(false);

    const passwordOptions = [
      config.useKeychainPassword
        ? { value: "existing-password", label: "Use existing value" }
        : undefined,
      { value: "no-password", label: "No password" },
      { value: "set-password", label: "Enter a password" },
    ].filter(notUndefined);

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
          value={config.host || ""}
          setValue={(host) => {
            setConfig({ ...config, host });
          }}
          label="Host"
        ></CodeInput>
        <CodeInput
          value={config.port ? config.port.toString() : ""}
          setValue={(port) => {
            setConfig({ ...config, port: parseInt(port) });
          }}
          label="Port"
        ></CodeInput>
        <CodeInput
          value={config.databaseName || ""}
          setValue={(databaseName) => {
            setConfig({ ...config, databaseName });
          }}
          label="Database Name"
        ></CodeInput>
        <CodeInput
          value={config.username || ""}
          setValue={(username) => {
            setConfig({ ...config, username });
          }}
          label="Username"
        />
        <FormInputLabel>Password</FormInputLabel>
        <OptionsRow>
          <SelectList
            options={passwordOptions}
            value={
              config.useKeychainPassword
                ? "existing-password"
                : config.password !== undefined
                ? "set-password"
                : "no-password"
            }
            onChange={(choice) => {
              if (choice === "existing-password") {
                setConfig({
                  ...config,
                  password: undefined,
                  useKeychainPassword: true,
                });
              } else if (choice === "no-password") {
                setConfig({
                  ...config,
                  password: undefined,
                  useKeychainPassword:
                    config.useKeychainPassword === undefined
                      ? undefined
                      : false,
                });
              } else {
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
          />
        </OptionsRow>
        {config.password !== undefined && (
          <CodeInput
            value={config.password}
            setValue={(password) => {
              setConfig({ ...config, password });
            }}
            placeholder="password"
          />
        )}
      </>
    );
  };

const OptionsRow = styled.div`
  display: flex;
  border: 1px solid #efefef;
  border-radius: 5px;
  overflow: hidden;
`;
