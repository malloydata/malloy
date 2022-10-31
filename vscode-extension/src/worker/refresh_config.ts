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

import { MessageConfig } from "./types";
import { CONNECTION_MANAGER } from "../server/connections";
import { log } from "./logger";

const DEFAULT_ROW_LIMIT = 50;

export const refreshConfig = ({ config }: MessageConfig): void => {
  const { rowLimit: rowLimitRaw, connections } = config;

  log("Config updated");

  CONNECTION_MANAGER.setConnectionsConfig(connections);
  const rowLimit = rowLimitRaw || DEFAULT_ROW_LIMIT;
  CONNECTION_MANAGER.setCurrentRowLimit(+rowLimit);
};
