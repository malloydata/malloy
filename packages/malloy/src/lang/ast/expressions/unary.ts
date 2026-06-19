/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {ExpressionDef} from '../types/expression-def';

export abstract class Unary extends ExpressionDef {
  constructor(readonly expr: ExpressionDef) {
    super({expr: expr});
  }
}
