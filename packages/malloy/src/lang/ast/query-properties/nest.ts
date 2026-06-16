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
      // A `limit:` on a single-stage nested `select:` can't be made correct:
      // the whole query is one fanned-out `group_set` scan, and a projection
      // has no grouping to collapse that fan-out, so its rows are the
      // replicated/join-multiplied scan rather than a real relation. Limiting
      // them ranks a phantom row set (wrong results, not just invalid SQL).
      // A real select needs a materialized relation -- the two-stage form
      // `{ select: ... } -> { select: ...; limit: N }`, where the pipeline
      // boundary materializes the rows. So this is by design, not a TODO; a
      // multi-stage nest is left alone. See issue #2895 for the full reasoning.
      if (checkedPipeline.length === 1) {
        const onlyStage = checkedPipeline[0];
        if (
          model.isProjectSegment(onlyStage) &&
          onlyStage.limit !== undefined
        ) {
          this.logError(
            'limit-in-nested-select',
            'Cannot use `limit:` directly in a nested `select:`. To limit the ' +
              'rows, do the `select:` first and limit it in a second stage, ' +
              'e.g. `{ select: ... } -> { select: ...; limit: N }`'
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
