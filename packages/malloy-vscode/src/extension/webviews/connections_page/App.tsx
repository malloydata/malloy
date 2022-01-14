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

import React, { useEffect, useState } from "react";
import { ConnectionConfig } from "../../../common";
import {
  ConnectionMessageType,
  ConnectionPanelMessage,
} from "../../webview_message_manager";

export const App: React.FC = () => {
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);

  useEffect(() => {
    const listener = (event: MessageEvent<ConnectionPanelMessage>) => {
      const message = event.data;

      switch (message.type) {
        case ConnectionMessageType.SetConnections:
          setConnections(message.connections);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  });

  return (
    <div>
      {connections.map((config) => (
        <div>
          <div>Name: {config.name}</div>
          <div>Backend: {config.backend}</div>
        </div>
      ))}
    </div>
  );
};
