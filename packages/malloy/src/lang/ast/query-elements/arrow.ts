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
  PipeSegment,
  Query,
  StructDef,
  isAtomicFieldType,
  refIsStructDef,
} from '../../../model/malloy_types';
import {Source} from '../elements/source';
import {StaticSpace} from '../field-space/static-space';
import {ViewOrScalarFieldReference} from '../query-items/field-references';
import {QOPDesc} from '../query-properties/qop-desc';
import {detectAndRemovePartialStages} from '../query-utils';
import {getFinalStruct, opOutputStruct} from '../struct-utils';
import {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {QueryComp} from '../types/query-comp';
import {QueryElement} from '../types/query-element';
import {SpaceField} from '../types/space-field';

export class Arrow extends MalloyElement {
  elementType = 'arrow';

  constructor(
    readonly source: Source | QueryElement | undefined,
    readonly operation: QOPDesc | ViewOrScalarFieldReference
  ) {
    super(source ? {source, operation} : {operation});
  }

  queryComp(isRefOk: boolean): QueryComp {
    let structDef: StructDef;
    let queryBase: Query;
    let fieldSpace: FieldSpace;
    if (this.source === undefined) {
      // For some reason the translator asked to generate a Query from something that was
      // syntactically only ever meant to be a View -- this is illegal and the translator can
      // safely barf
      throw new Error('Attempt to generate a Query from a View');
    } else if (this.source instanceof Source) {
      // We create a fresh query with either the QOPDesc as the head,
      // the view as the head, or the scalar as the head (if scalar lenses is enabled)
      const structRef = isRefOk
        ? this.source.structRef()
        : this.source.structDef();
      queryBase = {
        type: 'query',
        structRef,
        pipeline: [],
        location: this.location,
      };
      structDef = refIsStructDef(structRef)
        ? structRef
        : this.source.structDef();
      fieldSpace = new StaticSpace(structDef);
    } else {
      // We are adding a second stage to the given "source" query; we get the query and add a segment
      const lhsQuery = this.source.queryComp(isRefOk);
      queryBase = lhsQuery.query;
      structDef = lhsQuery.outputStruct;
      fieldSpace = new StaticSpace(lhsQuery.outputStruct);
    }
    if (this.operation instanceof ViewOrScalarFieldReference) {
      const lookup = this.operation.getField(fieldSpace);
      if (!lookup.found) {
        this.log(
          `Cannot find ${this.operation.refString} in output of LHS query`
        );
        throw new Error('TODO return something better here');
      } else if (isAtomicFieldType(lookup.found.typeDesc().dataType)) {
        if (!this.inExperiment('scalar_lenses', true)) {
          this.operation.log(
            `Cannot use scalar field ${this.operation.refString} as a view; use \`scalar_lenses\` experiment to enable this behavior`
          );
        }
        const newSegment: PipeSegment = {
          type: 'reduce',
          fields: [this.operation.refString],
        };
        return {
          query: {
            ...queryBase,
            pipeline: [...queryBase.pipeline, newSegment],
          },
          // TODO I think we can probably construct this on our own without asking the compiler...
          outputStruct: opOutputStruct(this, structDef, newSegment),
          refineInputStruct: structDef,
        };
      } else if (lookup.found.typeDesc().dataType === 'turtle') {
        if (this.operation.list.length > 1) {
          this.log('Cannot use view from join');
          throw new Error('TODO return something better here');
        }
        if (lookup.found instanceof SpaceField) {
          const fieldDef = lookup.found.fieldDef();
          if (fieldDef === undefined) {
            throw new Error('Expected field to have definition');
          }
          if (fieldDef.type !== 'turtle') {
            throw new Error('Expected field to be a view');
          }
          // TODO I think this is wrong...
          const annotation = fieldDef.annotation
            ? {inherits: fieldDef.annotation, ...queryBase.annotation}
            : queryBase.annotation;
          return {
            query: {
              ...queryBase,
              // TODO Pretty sure I need to recursively expand the views here, since `fieldDef` here could have
              // its own `pipeHead`
              pipeline: [...queryBase.pipeline, ...fieldDef.pipeline],
              annotation,
            },
            outputStruct: getFinalStruct(
              this.operation,
              structDef,
              fieldDef.pipeline
            ),
            refineInputStruct: structDef,
          };
        } else {
          throw new Error('Expected space field');
        }
      } else {
        this.operation.log('This operation is not supported');
        throw new Error('TODO return something better here');
      }
    } else {
      // We have a QOPDesc
      const newOperation = this.operation.getOp(fieldSpace, undefined);
      return {
        query: {
          ...queryBase,
          pipeline: [...queryBase.pipeline, newOperation.segment],
        },
        outputStruct: newOperation.outputSpace().structDef(),
        refineInputStruct: structDef,
      };
    }
  }

  query(): Query {
    const q = this.queryComp(true).query;
    // TODO reconsider whether this is still necessary?
    const {hasPartials, pipeline} = detectAndRemovePartialStages(q.pipeline);
    if (hasPartials) {
      this.log(
        "Can't determine view type (`group_by` / `aggregate` / `nest`, `project`, `index`)"
      );
      return {...q, pipeline};
    }
    return q;
  }
}
