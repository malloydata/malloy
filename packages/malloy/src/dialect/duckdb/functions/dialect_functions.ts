/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {
  DialectFunctionOverloadDef,
  anyExprType,
  arg,
  minScalar,
  overload,
  param,
  sql,
} from '../../functions/util';

export const DUCKDB_DIALECT_FUNCTIONS: {
  [name: string]: DialectFunctionOverloadDef[];
} = {
  to_timestamp: [
    overload(
      minScalar('timestamp'),
      [param('epoch_seconds', anyExprType('number'))],
      sql`TO_TIMESTAMP(${arg('epoch_seconds')})`
    ),
  ],
};
