/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {FieldReference} from '../query-items/field-references';
import type {FieldSpace} from '../types/field-space';
import type {LookupFound} from '../types/lookup-result';

export function resolveAggregateSource(
  source: FieldReference,
  fs: FieldSpace
): LookupFound | undefined {
  const lookup = source.getField(fs);
  if (lookup.error) {
    const at = lookup.error.at ?? source;
    at.logError(lookup.error.code, lookup.error.message);
    return undefined;
  }
  return lookup;
}
