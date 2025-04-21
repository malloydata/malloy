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

import * as model from '../../../model/malloy_types';
import type {FieldSpace} from '../types/field-space';
import {detectAndRemovePartialStages} from '../query-utils';
import {ViewFieldDeclaration} from '../source-properties/view-field-declaration';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {
  LegalRefinementStage,
  QueryClass,
} from '../types/query-property-interface';
import type {QueryBuilder} from '../types/query-builder';

export class NestFieldDeclaration
  extends ViewFieldDeclaration
  implements QueryPropertyInterface
{
  elementType = 'nest-field-declaration';
  queryRefinementStage = LegalRefinementStage.Single;
  forceQueryClass = QueryClass.Grouping;
  turtleDef: model.TurtleDef | undefined = undefined;

  queryExecute(executeFor: QueryBuilder) {
    executeFor.resultFS.pushFields(this);
  }

  getFieldDef(fs: FieldSpace): model.TurtleDef {
    if (this.turtleDef) return this.turtleDef;
    if (fs.isQueryFieldSpace()) {
      const {pipeline, annotation} = this.view.pipelineComp(
        fs,
        fs.outputSpace()
      );
      const compositeFieldUsage =
        pipeline[0] && model.isQuerySegment(pipeline[0])
          ? pipeline[0].compositeFieldUsage
          : undefined;
      const checkedPipeline = detectAndRemovePartialStages(pipeline, this);
      this.turtleDef = {
        type: 'turtle',
        name: this.name,
        pipeline: checkedPipeline,
        annotation: {...this.note, inherits: annotation},
        location: this.location,
        compositeFieldUsage,
      };
      return this.turtleDef;
    }
    throw this.internalError('Unexpected namespace for nest');
  }
}
