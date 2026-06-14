/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {TemporalTypeDef, TimestampUnit} from '../../../model/malloy_types';

import type {ExprResult} from './expr-result';

export type TimeResult = TemporalTypeDef &
  ExprResult & {
    timeframe?: TimestampUnit;
  };
