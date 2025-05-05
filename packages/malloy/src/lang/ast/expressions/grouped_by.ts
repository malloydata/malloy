/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {GroupedByReference} from '../query-items/field-references';
import {ListOf} from '../types/malloy-element';

export class GroupedBy extends ListOf<GroupedByReference> {
  elementType = 'require_group_by';

  constructor(readonly groupedByFields: GroupedByReference[]) {
    super(groupedByFields);
  }
}
