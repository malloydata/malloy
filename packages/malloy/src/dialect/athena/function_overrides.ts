/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {MalloyStandardFunctionImplementations as OverrideMap} from '../functions/malloy_standard_functions';
import {TRINO_MALLOY_STANDARD_OVERLOADS} from '../trino/function_overrides';

// Athena engine version 3 runs Trino's function library; an override that
// differs from Trino's goes here.
export const ATHENA_MALLOY_STANDARD_OVERLOADS: OverrideMap = {
  ...TRINO_MALLOY_STANDARD_OVERLOADS,
};
