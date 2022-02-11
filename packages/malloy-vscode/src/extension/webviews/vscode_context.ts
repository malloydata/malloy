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

import * as _webviewAPI from "vscode-webview";
import React, { useContext } from "react";
import { WebviewApi } from "./vscode_wrapper";

export function makeVSCodeContext<S, M>(): React.Context<WebviewApi<S, M>> {
  return React.createContext<WebviewApi<S, M>>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    undefined as any
  );
}

export function makeUseVSCodeContext<S, M>(
  context: React.Context<WebviewApi<S, M>>
) {
  return function useVSCodeContext(): WebviewApi<S, M> {
    const vscode = useContext(context);
    return vscode;
  };
}

export { getVSCodeAPI } from "./vscode_wrapper";
