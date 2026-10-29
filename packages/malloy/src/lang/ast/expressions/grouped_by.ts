/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {GroupedByReference} from '../query-items/field-references';
import {ListOf} from '../types/malloy-element';

export class GroupedBy extends ListOf<GroupedByReference> {
  elementType = 'require_group_by';

  constructor(readonly groupedByFields: GroupedByReference[]) {
    super(groupedByFields);
  }
}
