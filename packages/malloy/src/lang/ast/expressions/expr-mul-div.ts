/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {BinaryNumeric} from './binary-numeric';

export class ExprMulDiv extends BinaryNumeric<'*' | '/' | '%'> {
  elementType = '*/%';
}
