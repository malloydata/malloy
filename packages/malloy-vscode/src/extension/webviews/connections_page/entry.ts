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

import * as _webviewAPI from "vscode-webview";
import ReactDOM from "react-dom";
import React from "react";
import { App } from "./App";
import {
  getVSCodeAPI,
  ConnectionsVSCodeContext,
} from "./connections_vscode_context";
import { ConnectionPanelMessage } from "../../message_types";

(() => {
  const vscode = getVSCodeAPI<void, ConnectionPanelMessage>();
  const el = React.createElement(
    ConnectionsVSCodeContext.Provider,
    { value: vscode },
    [React.createElement(App, { key: "app" }, null)]
  );
  ReactDOM.render(el, document.getElementById("app"));
})();
