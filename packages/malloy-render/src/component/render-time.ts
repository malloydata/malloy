/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {renderTimeString} from '../util';
import type {RendererProps} from './types';

export function renderTime({dataColumn}: RendererProps) {
  if (!dataColumn.field.isAtomic())
    throw new Error(
      `Time renderer error: field ${dataColumn.field.name} is not an atomic field`
    );
  if (!dataColumn.isTime())
    throw new Error(
      `Time renderer error: field ${dataColumn.field.name} is not a date or timestamp`
    );

  const value = dataColumn.value;
  return renderTimeString(
    value,
    dataColumn.field.isDate(),
    dataColumn.field.timeframe
  );
}
