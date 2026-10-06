/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Tag} from '@malloydata/malloy-tag';
import type {AnnotationsDef, DocumentLocation} from '../model/malloy_types';
import type {ConnectionPropertyDefinition} from './registry';

/**
 * The annotation route a connection writes database metadata to:
 * `#(dbmeta) description="..."`. Connections write it when they read a
 * schema; it never appears in a model file.
 */
export const DBMETA_ROUTE = 'dbmeta';

const DBMETA_LOCATION: DocumentLocation = {
  url: `internal://${DBMETA_ROUTE}`,
  range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
};

/**
 * The connection property that turns on database metadata. Connections that
 * support it register this definition, so the option has the same name and
 * meaning on every backend. Off unless set.
 */
export const dbmetaProperty: ConnectionPropertyDefinition = {
  name: 'dbmeta',
  displayName: 'Database Metadata',
  type: 'boolean',
  optional: true,
  advanced: true,
  description:
    'Copy table and column descriptions from the database onto the schema, ' +
    'as #(dbmeta) description annotations.',
};

/**
 * Metadata a connection read from the database for one table or column.
 * Keys are normalized across databases: whatever a database calls it (a
 * description, a COMMENT), it arrives here as `description`.
 */
export interface DbMeta {
  description?: string | null;
}

/**
 * The `#(dbmeta)` annotation for a table or column, or `undefined` when there
 * is nothing to say, so callers can spread the result unconditionally.
 */
export function dbmetaAnnotations(meta: DbMeta): AnnotationsDef | undefined {
  const description = meta.description?.replace(/\r\n/g, '\n').trim();
  if (!description) return undefined;
  const text = Tag.withPrefix(`#(${DBMETA_ROUTE}) `)
    .set(['description'], description)
    .toString();
  return {
    notes: [
      {text: text.endsWith('\n') ? text : `${text}\n`, at: DBMETA_LOCATION},
    ],
  };
}
