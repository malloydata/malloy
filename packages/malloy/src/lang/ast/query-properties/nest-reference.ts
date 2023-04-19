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
  expressionIsAnalytic,
  expressionIsScalar,
  TypeDesc,
} from '../../../model';
import {FieldReference} from '../query-items/field-references';
import {FieldName} from '../types/field-space';

export class NestReference extends FieldReference {
  elementType = 'nestReference';
  constructor(readonly name: FieldName) {
    super([name]);
  }
  typecheck(type: TypeDesc) {
    if (type.dataType === 'turtle') {
      let useInstead: string;
      let kind: string;
      if (expressionIsAnalytic(type.expressionType)) {
        useInstead = 'a calculate';
        kind = 'an analytic';
      } else if (expressionIsScalar(type.expressionType)) {
        useInstead = 'a group_by or project';
        kind = 'a scalar';
      } else if (expressionIsAggregate(type.expressionType)) {
        useInstead = 'an aggregate';
        kind = 'an aggregate';
      } else {
        throw new Error(`Unexpected expression type ${type} not handled here`);
      }
      this.log(
        `Cannot use ${kind} field in a nest operation, did you mean to use ${useInstead} operation instead?`
      );
    }
  }
}
