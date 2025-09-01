/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
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
