/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as model from '../../../model/malloy_types';
import {nestStrategy} from '../../../model/nest-capability';
import type {FieldSpace} from '../types/field-space';
import {detectAndRemovePartialStages} from '../query-utils';
import {ViewFieldDeclaration} from '../source-properties/view-field-declaration';
import type {QueryPropertyInterface} from '../types/query-property-interface';
import {
  LegalRefinementStage,
  QueryClass,
} from '../types/query-property-interface';
import type {QueryBuilder} from '../types/query-builder';
import {attachDrillPaths} from './drill';

export class NestFieldDeclaration
  extends ViewFieldDeclaration
  implements QueryPropertyInterface
{
  elementType = 'nest-field-declaration';
  queryRefinementStage = LegalRefinementStage.Single;
  forceQueryClass = QueryClass.Grouping;
  statement = 'nest:';
  turtleDef: model.TurtleDef | undefined = undefined;

  queryExecute(executeFor: QueryBuilder) {
    executeFor.resultFS.pushFields(this);
  }

  getFieldDef(fs: FieldSpace): model.TurtleDef {
    if (this.turtleDef) return this.turtleDef;
    if (fs.isQueryFieldSpace()) {
      const {pipeline, annotations} = this.view.pipelineComp(
        fs,
        fs.outputSpace()
      );
      const refSummary =
        pipeline[0] && model.isQuerySegment(pipeline[0])
          ? pipeline[0].refSummary
          : undefined;
      const checkedPipeline = detectAndRemovePartialStages(pipeline, this);
      // Reject — at translate time, with a located message — any stage of this
      // nest the compiler can't emit for this dialect, rather than producing
      // broken SQL. The compiler asks segment-at-a-time as it recurses; the
      // translator holds the whole pipeline, so it asks every stage.
      const dialect = fs.dialectObj();
      if (dialect) {
        for (let i = 0; i < checkedPipeline.length; i++) {
          const strategy = nestStrategy(
            checkedPipeline[i],
            dialect,
            i < checkedPipeline.length - 1
          );
          if (strategy.kind === 'unsupported') {
            this.logError(strategy.reason, {dialect: dialect.name});
            break;
          }
        }
      }
      const pipelineWithDrillPaths = attachDrillPaths(
        checkedPipeline,
        this.name
      );
      this.turtleDef = {
        type: 'turtle',
        name: this.name,
        pipeline: pipelineWithDrillPaths,
        annotations: {
          ...this.note,
          inherits: annotations,
        },
        location: this.location,
        refSummary,
      };
      return this.turtleDef;
    }
    throw this.internalError('Unexpected namespace for nest');
  }
}
