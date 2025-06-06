/*
 * Copyright 2024 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {FunctionOrdering} from '../expressions/function-ordering';
import {Filter} from '../query-properties/filters';
import {Limit} from '../query-properties/limit';
import {GroupedBy} from '../expressions/grouped_by';
import {PartitionBy} from '../expressions/partition_by';
import type {MalloyElement} from './malloy-element';

export type FieldPropStatement =
  | Filter
  | Limit
  | PartitionBy
  | FunctionOrdering
  | GroupedBy;

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
