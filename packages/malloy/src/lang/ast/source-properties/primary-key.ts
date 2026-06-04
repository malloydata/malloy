/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {FieldName} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';

export class PrimaryKey extends MalloyElement {
  elementType = 'primary key';
  constructor(readonly field: FieldName) {
    super({field: field});
  }
}
