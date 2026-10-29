/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {PartitionByFieldReference} from '../query-items/field-references';
import {ListOf} from '../types/malloy-element';

export class PartitionBy extends ListOf<PartitionByFieldReference> {
  elementType = 'partition_by';

  constructor(readonly partitionFields: PartitionByFieldReference[]) {
    super(partitionFields);
  }
}
