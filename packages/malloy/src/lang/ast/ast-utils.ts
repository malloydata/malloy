/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ExprValue} from './types/expr-value';

/**
 * When a translation hits an error, log and return one of these as a value.
 * This will allow the rest of the translation walk to complete. The
 * generated SQL will have a reference to an impossible variable name
 * with the reason embedded in it.
 * @param reason very short phrase, only read by implementers
 * @return Expr which a debugging humnan will regognize
 */
export function errorFor(reason: string): ExprValue {
  return {
    type: 'error',
    expressionType: 'scalar',
    value: {node: 'error', message: reason},
    evalSpace: 'constant',
  };
}
