/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {AdditiveForReference} from '../query-items/field-references';
import {ListOf} from '../types/malloy-element';

export class AdditiveFor extends ListOf<AdditiveForReference> {
  elementType = 'additive_for';

  constructor(readonly additiveForFields: AdditiveForReference[]) {
    super(additiveForFields);
  }
}
