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

export const TRINO_DIALECT_FUNCTIONS: {
  [name: string]: DialectFunctionOverloadDef[];
} = {
  from_unixtime: [
    overload(
      minScalar('timestamp'),
      [param('unixtime', anyExprType('number'))],
      sql`FROM_UNIXTIME(${arg('unixtime')})`
    ),
  ],
};
