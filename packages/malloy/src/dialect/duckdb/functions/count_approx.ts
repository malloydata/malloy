/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {
  overload,
  minAggregate,
  maxScalar,
  sql,
  DialectFunctionOverloadDef,
  makeParam,
  anyExprType,
  param,
} from '../../functions/util';

export function fnCountApprox(): DialectFunctionOverloadDef[] {
  const value = makeParam('value', maxScalar('number'));
  return [
    overload(
      minAggregate('number'),
      [
        param(
          'value',
          anyExprType('string'),
          anyExprType('number'),
          anyExprType('date'),
          anyExprType('timestamp'),
          anyExprType('boolean')
        ),
      ],
      sql`APPROX_COUNT_DISTINCT(${value.arg})`,
      {isSymmetric: true}
    ),
  ];
}
