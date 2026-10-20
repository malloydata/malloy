/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ExprValue} from '../types/expr-value';
import type {FieldSpace} from '../types/field-space';
import type {MalloyElement} from '../types/malloy-element';

/**
 * On a dialect with booleanType 'none' a boolean is a condition and never a
 * value. When `type` is a boolean about to be used as a value, logs an error
 * at `logTo` and returns an error-typed value for the caller to return in
 * place of what it was building, so the enclosing expressions see an error
 * and stay quiet. Otherwise returns undefined. `where` says how the boolean
 * was used, `hint` what to write instead.
 */
export function booleanValueError(
  fs: FieldSpace,
  type: {type: string} | undefined,
  where: string,
  logTo: MalloyElement,
  hint: string
): ExprValue | undefined {
  const dialect = fs.dialectObj();
  if (type?.type !== 'boolean' || dialect?.booleanType !== 'none') {
    return undefined;
  }
  return logTo.loggedErrorExpr('boolean-value-unsupported', {
    dialect: dialect.name,
    where,
    hint,
  });
}

/** The hint where a boolean's unknown state is examined: `is null`, `??` */
export const CONDITION_HINT =
  'test the condition itself; unknown already tests as false';

/** The hint for a boolean compared with anything */
export const COMPARE_HINT = 'test the condition itself, or its not';

/** The hint where a number would do: a function argument, a cast */
export const NUMBER_HINT = 'write the value, pick 1 when … else 0';

/** The hint for a boolean as a result column, from the source text it came from */
export function resultColumnHint(src: string): string {
  return `write the value, pick 'yes' when ${src} else 'no'`;
}

/** The hint for a `pick` or `case` whose result is a boolean */
export const CHOICE_HINT =
  "write values, pick 'yes' when … else 'no', or the condition itself with and, or and not";
