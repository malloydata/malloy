/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {TimestampUnit} from '../../../model/malloy_types';
import {TD} from '../../../model/malloy_types';

import type {ExprValue} from './expr-value';
import type {TimeResult} from './time-result';

export type GranularResult = TimeResult & {
  timeframe: TimestampUnit;
};

export function isGranularResult(v: ExprValue): v is GranularResult {
  if (TD.isTemporal(v)) {
    return (v as GranularResult).timeframe !== undefined;
  }
  return false;
}
