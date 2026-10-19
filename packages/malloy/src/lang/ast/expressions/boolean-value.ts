/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {FieldSpace} from '../types/field-space';
import type {MalloyElement} from '../types/malloy-element';

/**
 * On a dialect with booleanType 'none' a boolean is a condition and never a
 * value. Logs an error at `logTo` when `type` is a boolean about to be used
 * as a value; `where` says how, `hint` what to write instead. Returns true
 * when it logged.
 */
export function refuseBooleanValue(
  fs: FieldSpace,
  type: {type: string} | undefined,
  where: string,
  logTo: MalloyElement,
  hint: string
): boolean {
  const dialect = fs.dialectObj();
  if (type?.type !== 'boolean' || dialect?.booleanType !== 'none') {
    return false;
  }
  logTo.logError('boolean-value-unsupported', {
    dialect: dialect.name,
    where,
    hint,
  });
  return true;
}
