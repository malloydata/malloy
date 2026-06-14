/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {FieldReferences} from '../query-items/field-references';
import {MalloyElement} from '../types/malloy-element';

export class FieldListEdit extends MalloyElement {
  elementType = 'fieldListEdit';
  constructor(
    readonly edit: 'accept' | 'except',
    readonly refs: FieldReferences
  ) {
    super({refs: refs});
  }
}
