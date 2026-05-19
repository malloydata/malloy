/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Connection} from '@malloydata/malloy';

export interface ConnectionFactory {
  postProcessConnection?(conn: Connection, workingDir: string): void;
}
