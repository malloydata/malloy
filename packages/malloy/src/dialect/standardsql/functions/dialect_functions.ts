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

export const STANDARDSQL_DIALECT_FUNCTIONS: {
  [name: string]: DialectFunctionOverloadDef[];
} = {
  date_from_unix_date: [
    overload(
      minScalar('date'),
      [param('unix_date', anyExprType('number'))],
      sql`DATE_FROM_UNIX_DATE(${arg('unix_date')})`
    ),
  ],
};
