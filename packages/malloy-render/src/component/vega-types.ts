/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {Spec} from 'vega';
import type {TopLevelSpec} from 'vega-lite';

/**
 * TODO: create vega-lite-types package that exports types from vega-lite
 * Because vega-lite typings are not available today, we are forced to use any
 * */
// tslint:disable-next-line:no-any
export type VegaJSON = any;

export function asVegaSpec(v: VegaJSON) {
  return v as unknown as Spec;
}

export function asVegaLiteSpec(v: VegaJSON) {
  return v as unknown as TopLevelSpec;
}
