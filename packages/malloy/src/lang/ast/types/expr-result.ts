/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Expr, TypeDesc} from '../../../model/malloy_types';

export interface WithValue {
  value: Expr;
}

export type ExprResult = TypeDesc & WithValue;
