/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Expr, TypeDesc} from '../../../model/malloy_types';

type MorphicValues = Record<string, Expr>;
export interface WithValue {
  value: Expr;
  morphic?: MorphicValues;
}

export type ExprResult = TypeDesc & WithValue;
