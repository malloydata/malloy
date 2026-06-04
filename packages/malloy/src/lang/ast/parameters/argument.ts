/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {ParameterFieldReference} from '../query-items/field-references';

import type {ExpressionDef} from '../types/expression-def';
import {MalloyElement} from '../types/malloy-element';

interface ArgInit {
  id?: ParameterFieldReference | undefined;
  value: ExpressionDef;
}

export class Argument extends MalloyElement {
  elementType = 'Argument';
  readonly id: ParameterFieldReference | undefined;
  readonly value: ExpressionDef;

  constructor(init: ArgInit) {
    super({...init});
    this.id = init.id;
    this.value = init.value;
  }
}
