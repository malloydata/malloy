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

import { ConnectionConfig } from "../common";

export interface MalloyConfig {
  /** Maximum number of top-level rows to fetch when running queries. */
  rowLimit: number;
  /** Path to directory to save downloaded results */
  downloadsPath: string;
  /** Connections for Malloy to use to access data when compiling and querying. */
  connections: ConnectionConfig[];
}
