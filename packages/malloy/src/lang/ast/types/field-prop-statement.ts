/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {FunctionOrdering} from '../expressions/function-ordering';
import {Filter} from '../query-properties/filters';
import {Limit} from '../query-properties/limit';
import {GroupedBy} from '../expressions/grouped_by';
import {PartitionBy} from '../expressions/partition_by';
import type {MalloyElement} from './malloy-element';

export type FieldPropStatement =
  Filter | Limit | PartitionBy | FunctionOrdering | GroupedBy;

export function isFieldPropStatement(
  el: MalloyElement
): el is FieldPropStatement {
  return (
    el instanceof Filter ||
    el instanceof Limit ||
    el instanceof PartitionBy ||
    el instanceof FunctionOrdering ||
    el instanceof GroupedBy
  );
}
