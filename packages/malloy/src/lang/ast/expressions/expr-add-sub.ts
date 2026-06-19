/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {BinaryNumeric} from './binary-numeric';

export class ExprAddSub extends BinaryNumeric<'+' | '-'> {
  elementType = '+-';
}
