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
  /**
   * Both arguments say what looseness the caller will accept.
   *
   * @param isRefOk `structRef` may be left as the name of a source. False
   *   means expand it, which is what a caller writing this query into
   *   something that must stand on its own needs.
   * @param isPartialOk The pipeline may contain `partial` segments, whose
   *   query class is not decided yet. Only the base of a refinement can
   *   accept those, because the refinement is what decides the class.
   *   False means the pipeline is finished and the compiler can read it.
   */
  queryComp(isRefOk: boolean, isPartialOk: boolean): QueryComp;
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
