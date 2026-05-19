/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Connection} from '@malloydata/malloy';

export async function getSourceUrl(
  tablePath: string,
  connection: Connection
): Promise<string | undefined> {
  const metadata = await connection.fetchTableMetadata(tablePath);
  return metadata.url;
}

export const unquoteIdentifier = (identifier: string): string =>
  identifier
    .split('.')
    .map(part => part.replace(/(^`|`$)/g, ''))
    .join('.');
