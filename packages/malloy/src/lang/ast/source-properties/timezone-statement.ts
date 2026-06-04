/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {QueryBuilder} from '../types/query-builder';
import {MalloyElement} from '../types/malloy-element';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {DateTime} from 'luxon';

export class TimezoneStatement
  extends MalloyElement
  implements QueryPropertyInterface
{
  elementType = 'timezone';
  forceQueryClass = undefined;
  queryRefinementStage = undefined;
  constructor(readonly tz: string) {
    super();
  }

  get isValid(): boolean {
    try {
      DateTime.fromISO('2020-02-19T00:00:00', {zone: this.tz});
      return true;
    } catch {
      return false;
    }
  }

  queryExecute(executeFor: QueryBuilder) {
    executeFor.resultFS.setTimezone(this.tz);
  }
}
