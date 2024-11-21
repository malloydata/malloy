/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {FieldReferences} from '../query-items/field-references';
import {MalloyElement} from '../types/malloy-element';

export class AccessModifier extends MalloyElement {
  elementType = 'access_modifier';
  constructor(
    readonly access: 'private' | 'protected',
    readonly refs: FieldReferences
  ) {
    super({refs: refs});
  }
}
