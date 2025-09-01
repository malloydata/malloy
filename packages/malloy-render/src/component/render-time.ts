/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {renderDateTimeField} from './render-numeric-field';
import type {RendererProps} from './types';

export function renderTime({dataColumn}: RendererProps) {
  if (!dataColumn.field.isBasic())
    throw new Error(
      `Time renderer error: field ${dataColumn.field.name} is not an atomic field`
    );
  if (!dataColumn.isTime())
    throw new Error(
      `Time renderer error: field ${dataColumn.field.name} is not a date or timestamp`
    );

  const value = dataColumn.value;
  return renderDateTimeField(dataColumn.field, value, {
    isDate: dataColumn.field.isDate(),
    timeframe: dataColumn.field.timeframe,
  });
}
