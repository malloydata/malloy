/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {MalloyElement} from './malloy-element';
import {QueryArrow} from '../query-elements/query-arrow';
import {QueryRefine} from '../query-elements/query-refine';
import {QueryReference} from '../query-elements/query-reference';
import {QueryRaw} from '../query-elements/query-raw';
import type {Query} from '../../../model/malloy_types';
import type {QueryComp} from './query-comp';

export interface QueryElement extends MalloyElement {
  queryComp(isRefOk: boolean): QueryComp;
  query(isRefOk?: boolean): Query;
}

export function isQueryElement(e: MalloyElement): e is QueryElement {
  return (
    e instanceof QueryArrow ||
    e instanceof QueryRefine ||
    e instanceof QueryReference ||
    e instanceof QueryRaw
  );
}
