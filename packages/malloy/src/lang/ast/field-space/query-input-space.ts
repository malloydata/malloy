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
 
/**
 * Unlike a source, which is a refinement of a namespace, a query
 * is creating a new unrelated namespace. The query starts with a
 * source, which it might modify. This set of fields used to resolve
 * expressions in the query is called the "input space". There is a
 * specialized QuerySpace for each type of query operation.
 */

import {FieldDeclaration} from '../query-items/field-declaration';
import {Join} from '../query-properties/joins';
import {SourceSpec, SpaceSeed} from '../space-seed';
import {FieldSpace, QueryFieldSpace} from '../types/field-space';
import {RefinedSpace} from './refined-space';

export class QueryInputSpace extends RefinedSpace implements QueryFieldSpace {
  nestParent?: QueryInputSpace;
  extendList: string[] = [];

  /**
   * Because of circularity concerns this constructor is not typed
   * properly ...
   * @param input The source which might be extended
   * @param queryOutput MUST BE A QuerySpace
   */
  constructor(
    input: SourceSpec,
    private queryOutput: FieldSpace
  ) {
    const inputSpace = new SpaceSeed(input);
    super(inputSpace.structDef);
  }

  extendSource(extendField: Join | FieldDeclaration): void {
    this.pushFields(extendField);
    if (extendField instanceof Join) {
      this.extendList.push(extendField.name.refString);
    } else {
      this.extendList.push(extendField.defineName);
    }
  }

  isQueryFieldSpace() {
    return true;
  }

  outputSpace() {
    return this.queryOutput;
  }

  inputSpace() {
    return this;
  }
}
