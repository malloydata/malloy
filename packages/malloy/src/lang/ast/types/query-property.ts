/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {MalloyElement} from './malloy-element';
import type {QueryPropertyInterface} from './query-property-interface';

export type QueryProperty = MalloyElement & QueryPropertyInterface;

export function isQueryProperty(q: MalloyElement): q is QueryProperty {
  return 'queryRefinementStage' in q && 'forceQueryClass' in q;
}
