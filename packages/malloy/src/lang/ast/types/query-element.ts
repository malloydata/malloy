/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {MalloyElement} from './malloy-element';
import {QueryArrow} from '../query-elements/query-arrow';
import {QueryRefine} from '../query-elements/query-refine';
import {QueryReference} from '../query-elements/query-reference';
import {QueryRaw} from '../query-elements/query-raw';
import {Query} from '../../../model/malloy_types';
import {QueryComp} from './query-comp';

export interface QueryElement extends MalloyElement {
  queryComp(isRefOk: boolean): QueryComp;
  query(): Query;
}

export function isQueryElement(e: MalloyElement): e is QueryElement {
  return (
    e instanceof QueryArrow ||
    e instanceof QueryRefine ||
    e instanceof QueryReference ||
    e instanceof QueryRaw
  );
}
