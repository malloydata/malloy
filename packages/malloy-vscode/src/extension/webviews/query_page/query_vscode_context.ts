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

import { QueryPanelMessage } from "../../message_types";
import { makeVSCodeContext } from "../vscode_context";
import { makeUseVSCodeContext } from "../vscode_context";

export const QueryVSCodeContext = makeVSCodeContext<void, QueryPanelMessage>();

export const useQueryVSCodeContext = makeUseVSCodeContext(QueryVSCodeContext);

export { getVSCodeAPI } from "../vscode_context";
