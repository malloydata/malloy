/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {RequireGroupByReference} from '../query-items/field-references';
import {ListOf} from '../types/malloy-element';

export class RequireGroupBy extends ListOf<RequireGroupByReference> {
  elementType = 'require_group_by';

  constructor(readonly requireGroupByFields: RequireGroupByReference[]) {
    super(requireGroupByFields);
  }
}
