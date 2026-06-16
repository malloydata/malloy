/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
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
import {attachDrillPaths} from './drill';

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
      const {pipeline, annotations} = this.view.pipelineComp(
        fs,
        fs.outputSpace()
      );
      const refSummary =
        pipeline[0] && model.isQuerySegment(pipeline[0])
          ? pipeline[0].refSummary
          : undefined;
      const checkedPipeline = detectAndRemovePartialStages(pipeline, this);
      // A single-stage nested `select:` (project) is collapsed inline into a
      // `LIST(...)` aggregate at the parent's group set, so its fields never
      // exist as flat columns. A `limit:` on it is implemented with a
      // `ROW_NUMBER()` that orders/partitions by those (now absent) columns,
      // producing invalid SQL on every dialect. Reject it at compile time.
      // (A multi-stage nest applies the limit in its own materialized stage
      // before the collapse, so it is left alone. See issue #2895 for the fix
      // that would make the single-stage form work.)
      if (checkedPipeline.length === 1) {
        const onlyStage = checkedPipeline[0];
        if (
          model.isProjectSegment(onlyStage) &&
          onlyStage.limit !== undefined
        ) {
          this.logError(
            'limit-in-nested-select',
            'Cannot use `limit:` in a nested `select:` yet -- move the ' +
              '`limit:` to a later stage, e.g. ' +
              '`{ select: ... } -> { select: ...; limit: N }`'
          );
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
