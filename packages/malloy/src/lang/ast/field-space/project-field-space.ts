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

import {
  expressionIsAggregate,
  expressionInvolvesAggregate,
  expressionIsAnalytic,
  TypeDesc,
  TD,
} from '../../../model/malloy_types';

import {QuerySpace} from './query-spaces';

export class ProjectFieldSpace extends QuerySpace {
  readonly segmentType = 'project';

  canContain(typeDesc: TypeDesc | undefined): boolean {
    if (
      typeDesc === undefined ||
      !TD.isLeafAtomic(typeDesc) ||
      expressionIsAggregate(typeDesc.expressionType)
    ) {
      // We don't need to log here, because an error should have already been logged.
      return false;
    }
    // TODO it would be really nice to attach this error message to the specific field,
    // rather than the whole query.
    if (
      expressionInvolvesAggregate(typeDesc.expressionType) &&
      expressionIsAnalytic(typeDesc.expressionType)
    ) {
      this.logError(
        'aggregate-analytic-in-select',
        'Cannot add aggregate analyics to select'
      );
      return false;
    }
    return true;
  }
}
