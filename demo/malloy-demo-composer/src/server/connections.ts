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

import { FixedConnectionMap } from "@malloydata/malloy";
import { BigQueryConnection } from "@malloydata/db-bigquery";

export const CONNECTIONS = new FixedConnectionMap(
  new Map([["bigquery", new BigQueryConnection("bigquery")]]),
  "bigquery"
);
