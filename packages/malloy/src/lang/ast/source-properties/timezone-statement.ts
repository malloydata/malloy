/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {Dialect} from '../../../dialect/dialect';
import type {ExprString} from '../expressions/expr-string';
import type {QueryBuilder} from '../types/query-builder';
import {MalloyElement} from '../types/malloy-element';
import type {QueryPropertyInterface} from '../types/query-property-interface';

export class TimezoneStatement
  extends MalloyElement
  implements QueryPropertyInterface
{
  elementType = 'timezone';
  forceQueryClass = undefined;
  queryRefinementStage = undefined;
  constructor(private readonly timezone: ExprString) {
    super({timezone});
  }

  timezoneName(): string | undefined {
    const name = this.timezone.value;
    if (!Dialect.isSafeTimezoneName(name)) {
      this.logError(
        'invalid-timezone',
        {timezone: name},
        {at: this.timezone.location}
      );
      return undefined;
    }
    return name;
  }

  queryExecute(executeFor: QueryBuilder) {
    const timezone = this.timezoneName();
    if (timezone !== undefined) {
      executeFor.resultFS.setTimezone(timezone);
    }
  }
}
