/*
 * Copyright 2023 Google LLC
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

export * from './malloy_types';

import type {ModelRootInterface} from './query_node';
import {QueryField, QueryStruct} from './query_node';
import {exprToSQL} from './expression_compiler';
import {QueryQuery} from './query_query';
import {FieldInstanceField} from './field_instance';
import {QueryModelImpl} from './query_model_impl';

function getLookupFun(
  mri: ModelRootInterface
): (name: string) => QueryStruct | undefined {
  if (mri instanceof QueryModelImpl) {
    return (name: string) => mri.structs.get(name);
  }
  return () => undefined;
}

// Register the functions which break difficult circularity
FieldInstanceField.registerExpressionCompiler(exprToSQL);
QueryStruct.registerTurtleFieldMaker((field, parent) =>
  QueryQuery.makeQuery(
    field,
    parent,
    undefined,
    false,
    getLookupFun(parent.getModel())
  )
);

export {QueryField, QueryStruct, QueryQuery, QueryModelImpl as QueryModel};

export {getResultStructDefForQuery} from './query_model_impl';
export {indent, composeSQLExpr} from './utils';
export {Segment, getResultStructDefForView} from './segment';
