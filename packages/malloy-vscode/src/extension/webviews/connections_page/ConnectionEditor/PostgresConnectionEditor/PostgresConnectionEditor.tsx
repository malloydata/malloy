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
import { PostgresConnectionConfig } from "../../../../../common/connection_manager_types";

interface PostgresConnectionEditorProps {
  config: PostgresConnectionConfig;
  setConfig: (config: PostgresConnectionConfig) => void;
}

export const PostgresConnectionEditor: React.FC<PostgresConnectionEditorProps> =
  ({ config, setConfig }) => {
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
          Host:
          <input
            value={config.host}
            onChange={(e) => {
              setConfig({ ...config, host: e.target.value });
            }}
          ></input>
        </div>
        <div>
          Port:
          <input
            value={config.port}
            onChange={(e) => {
              setConfig({ ...config, port: parseInt(e.target.value) });
            }}
            type="number"
          ></input>
        </div>
        <div>
          Database Name:
          <input
            value={config.databaseName}
            onChange={(e) => {
              setConfig({ ...config, databaseName: e.target.value });
            }}
          ></input>
        </div>
        <div>
          Username:
          <input
            value={config.username}
            onChange={(e) => {
              setConfig({ ...config, username: e.target.value });
            }}
          ></input>
        </div>
        <div>
          Password:
          <div>
            {config.useKeychainPassword !== undefined && (
              <div>
                <input
                  type="radio"
                  value="keychain"
                  checked={config.useKeychainPassword}
                  onChange={() =>
                    setConfig({
                      ...config,
                      password: undefined,
                      useKeychainPassword: true,
                    })
                  }
                />
                Use existing value
              </div>
            )}
            <div>
              <input
                type="radio"
                value="none"
                key="none"
                checked={
                  !config.useKeychainPassword && config.password === undefined
                }
                onChange={() =>
                  setConfig({
                    ...config,
                    password: undefined,
                    useKeychainPassword: config.useKeychainPassword
                      ? false
                      : undefined,
                  })
                }
              />
              No password
            </div>
            <div>
              <input
                type="radio"
                value="specified"
                key="specified"
                checked={config.password !== undefined}
                onChange={() =>
                  setConfig({
                    ...config,
                    password: "",
                    useKeychainPassword: config.useKeychainPassword
                      ? false
                      : undefined,
                  })
                }
              />
              Enter a password
              {config.password !== undefined && (
                <span>
                  :
                  <input
                    value={config.password}
                    onChange={(e) => {
                      setConfig({
                        ...config,
                        password: e.target.value,
                      });
                    }}
                    placeholder="Optional"
                  />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };
