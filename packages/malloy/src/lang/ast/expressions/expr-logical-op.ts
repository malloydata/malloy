/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {BinaryBoolean} from './binary-boolean';
import * as TDU from '../typedesc-utils';

export class ExprLogicalOp extends BinaryBoolean<'and' | 'or'> {
  elementType = 'logical operator';
  legalChildTypes = [TDU.boolT, TDU.aggregateBoolT];
}
