/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {AnnotationsDef, DocumentLocation} from '../model/malloy_types';
import type {ConnectionPropertyDefinition} from './registry';

/**
 * The `url` on every note made from a database description. A note made from
 * a description has no Malloy source to point at; a fixed URL lets a tool
 * tell it apart from a doc string written in a model.
 */
export const SCHEMA_DESCRIPTION_URL = 'internal://schema-description';

const SCHEMA_DESCRIPTION_LOCATION: DocumentLocation = {
  url: SCHEMA_DESCRIPTION_URL,
  range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
};

/**
 * The connection property that turns database descriptions into doc strings.
 * Connections that support it register this definition, so the option has the
 * same name and meaning on every backend.
 */
export const includeDescriptionsProperty: ConnectionPropertyDefinition = {
  name: 'includeDescriptions',
  displayName: 'Include Descriptions',
  type: 'boolean',
  optional: true,
  advanced: true,
  description:
    'Attach table and column descriptions from the database to the schema ' +
    'as doc strings (the `#"` annotation route). Doc strings written in a ' +
    'model are kept alongside them.',
};

/**
 * Annotations carrying a database description as a doc string, the same
 * annotation a model author would write with `#"`. A single-line description
 * becomes `#" text`, a multi-line one a `#|"` block so markdown line breaks
 * survive. Returns `undefined` for a missing or blank description, so callers
 * can spread the result unconditionally.
 */
export function schemaDescriptionAnnotations(
  description: string | null | undefined
): AnnotationsDef | undefined {
  const text = description?.replace(/\r\n/g, '\n').trim();
  if (!text) return undefined;
  const noteText = text.includes('\n') ? `#|"\n${text}` : `#" ${text}\n`;
  return {notes: [{text: noteText, at: SCHEMA_DESCRIPTION_LOCATION}]};
}
