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
  QueryFieldDef,
  TurtleDef,
  isAtomicFieldType,
  isRawSegment,
} from '../../../model/malloy_types';
import {ErrorFactory} from '../error-factory';
import {DynamicSpace} from '../field-space/dynamic-space';
import {QuerySpace} from '../field-space/query-spaces';
import {StaticSpace} from '../field-space/static-space';
import {ViewOrScalarFieldReference} from '../query-items/field-references';
import {ViewField} from '../query-properties/nest';
import {QOpDesc} from '../query-properties/qop-desc';
import {getFinalStruct, opOutputStruct} from '../struct-utils';
import {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {OpDesc} from '../types/op-desc';
import {PipelineComp} from '../types/pipeline-comp';
import {LegalRefinementStage} from '../types/query-property-interface';
import {SpaceField} from '../types/space-field';

export abstract class View extends MalloyElement {
  abstract pipelineComp(fs: FieldSpace, isNestIn?: QuerySpace): PipelineComp;

  pipeline(fs: FieldSpace, isNestIn?: QuerySpace): PipeSegment[] {
    return this.pipelineComp(fs, isNestIn).pipeline;
  }

  abstract refine(
    inputFS: FieldSpace,
    _pipeline: PipeSegment[],
    isNestIn: QuerySpace | undefined
  ): PipeSegment[];
}

export class QOpDescView extends View {
  elementType = 'qopdesc-view';
  constructor(readonly operation: QOpDesc) {
    super({operation});
  }

  pipelineComp(fs: FieldSpace, isNestIn?: QuerySpace): PipelineComp {
    const newOperation = this.operation.getOp(fs, isNestIn);
    return {
      pipeline: [newOperation.segment],
      outputStruct: newOperation.outputSpace().structDef(),
    };
  }

  private getOp(
    inputFS: FieldSpace,
    isNestIn: QuerySpace | undefined,
    qOpDesc: QOpDesc,
    refineThis: PipeSegment
  ): PipeSegment {
    qOpDesc.refineFrom(refineThis);
    return qOpDesc.getOp(inputFS, isNestIn).segment;
  }

  refine(
    inputFS: FieldSpace,
    _pipeline: PipeSegment[],
    isNestIn: QuerySpace | undefined
  ): PipeSegment[] {
    const pipeline = [..._pipeline];
    if (pipeline.length === 0) {
      return pipeline;
    }
    if (pipeline.length === 1) {
      this.operation.refineFrom(pipeline[0]);
      return [this.getOp(inputFS, isNestIn, this.operation, pipeline[0])];
    }
    const headRefinements = new QOpDesc([]);
    const tailRefinements = new QOpDesc([]);
    for (const qop of this.operation.list) {
      switch (qop.queryRefinementStage) {
        case LegalRefinementStage.Head:
          headRefinements.push(qop);
          break;
        case LegalRefinementStage.Single:
          qop.log('Illegal in refinement of a query with more than one stage');
          break;
        case LegalRefinementStage.Tail:
          tailRefinements.push(qop);
          break;
        default:
          qop.log('Illegal query refinement');
      }
    }
    if (headRefinements.notEmpty()) {
      this.has({headRefinements});
      pipeline[0] = this.getOp(
        inputFS,
        undefined,
        headRefinements,
        pipeline[0]
      );
    }
    if (tailRefinements.notEmpty()) {
      const last = pipeline.length - 1;
      this.has({tailRefinements});
      const finalIn = getFinalStruct(
        this,
        inputFS.structDef(),
        pipeline.slice(-1)
      );
      pipeline[last] = this.getOp(
        new StaticSpace(finalIn),
        undefined,
        tailRefinements,
        pipeline[last]
      );
    }
    return pipeline;
  }
}

export class ReferenceView extends View {
  elementType = 'reference-view';
  constructor(readonly reference: ViewOrScalarFieldReference) {
    super({reference});
  }

  // `_isNestIn` is not needed because referenced fields can never be fields defined
  // in nest parents anyway
  pipelineComp(fs: FieldSpace, _isNestIn?: QuerySpace): PipelineComp {
    const lookup = this.reference.getField(fs);
    const oops = function () {
      return {
        inputStruct: ErrorFactory.structDef,
        outputStruct: ErrorFactory.structDef,
        pipeline: [],
      };
    };
    if (!lookup.found) {
      this.log(`\`${this.reference.refString}\` is not defined`);
      return oops();
    } else if (isAtomicFieldType(lookup.found.typeDesc().dataType)) {
      if (!this.inExperiment('scalar_lenses', true)) {
        this.reference.log(
          `Cannot use scalar field \`${this.reference.refString}\` as a view; use \`scalar_lenses\` experiment to enable this behavior`
        );
      }
      const newSegment: PipeSegment = {
        type: 'reduce',
        fields: [this.reference.refString],
      };
      return {
        pipeline: [newSegment],
        name: this.reference.nameString,
        // TODO I think we can probably construct this on our own without asking the compiler...
        outputStruct: opOutputStruct(this, fs.structDef(), newSegment),
      };
    } else if (lookup.found.typeDesc().dataType === 'turtle') {
      if (this.reference.list.length > 1) {
        this.log('Cannot use view from join');
        return oops();
      }
      // TODO the type narrowing here is awful and I should redo it
      if (lookup.found instanceof SpaceField) {
        const fieldDef = lookup.found.fieldDef();
        if (fieldDef === undefined) {
          throw new Error('Expected field to have definition');
        }
        if (fieldDef.type !== 'turtle') {
          throw new Error('Expected field to be a view');
        }
        return {
          pipeline: [...fieldDef.pipeline],
          name: fieldDef.name,
          annotation: fieldDef.annotation,
          outputStruct: getFinalStruct(
            this.reference,
            fs.structDef(),
            fieldDef.pipeline
          ),
        };
      } else {
        throw new Error('Expected space field');
      }
    } else {
      this.reference.log('This operation is not supported');
      return oops();
    }
  }

  private getRefinementSegment(fs: FieldSpace): PipeSegment | undefined {
    const res = this.reference.getField(fs);
    if (!res.found) {
      this.reference.log(`no such view \`${this.reference.refString}\``);
      return;
    }
    if (res.found instanceof SpaceField) {
      const fieldDef = res.found.fieldDef();
      if (fieldDef?.type === 'turtle') {
        if (fieldDef.pipeline.length > 1) {
          this.reference.log(
            `named refinement \`${this.reference.refString}\` must have exactly one stage`
          );
          return;
        }
        if (this.reference.list.length > 1) {
          this.log('Cannot use view from join as refinement');
          return;
        }
        return fieldDef.pipeline[0];
      }
      if (fieldDef?.type !== 'struct') {
        if (this.reference.inExperiment('scalar_lenses', true)) {
          return {type: 'reduce', fields: [this.reference.refString]};
        }
      }
    }
    this.reference.log(
      `named refinement \`${
        this.reference.refString
      }\` must be a view, found a ${res.found.typeDesc().dataType}`
    );
  }

  refine(
    inputFS: FieldSpace,
    pipeline: PipeSegment[],
    _isNestIn: QuerySpace | undefined
  ): PipeSegment[] {
    if (pipeline.length === 1) {
      return [this.getOp(inputFS, pipeline[0]).segment];
    } else {
      this.reference.log(
        'Named refinements of multi-stage views are not supported'
      );
      // TODO better error pipeline?
      return pipeline;
    }
  }

  getOp(inputFS: FieldSpace, refineTo: PipeSegment): OpDesc {
    const to = {...refineTo};
    if (isRawSegment(to)) {
      this.log('Cannot refine raw query, must add an explicit query stage');
    } else {
      const from = this.getRefinementSegment(inputFS);
      if (from) {
        // TODO need to disallow partial + index for now to make the types happy
        if (
          to.type === 'partial' &&
          from.type !== 'index' &&
          from.type !== 'raw'
        ) {
          to.type = from.type;
        } else if (from.type !== to.type) {
          this.log(`cannot refine ${to.type} view with ${from.type} view`);
        }

        if (
          from.type !== 'index' &&
          to.type !== 'index' &&
          from.type !== 'raw'
        ) {
          if (from.orderBy !== undefined || from.by !== undefined) {
            if (to.orderBy === undefined && to.by === undefined) {
              if (from.orderBy) {
                to.orderBy = from.orderBy;
              } else if (from.by) {
                to.by = from.by;
              }
            } else {
              this.log('refinement cannot override existing ordering');
            }
          }

          if (from.limit !== undefined) {
            if (to.limit === undefined) {
              to.limit = from.limit;
            } else {
              this.log('refinement cannot override existing limit');
            }
          }
        }

        to.filterList =
          to.filterList !== undefined || from.filterList !== undefined
            ? [...(to.filterList ?? []), ...(from.filterList ?? [])]
            : undefined;

        const overlappingFields: (QueryFieldDef | string)[] = [];
        const nonOverlappingFields: (QueryFieldDef | string)[] = [];
        const existingNames = new Map<string, QueryFieldDef | string>(
          to.fields.map(
            (f: QueryFieldDef | string): [string, QueryFieldDef | string] => [
              extractName(f),
              f,
            ]
          )
        );
        for (const field of from.fields) {
          if (existingNames.has(extractName(field))) {
            overlappingFields.push(field);
          } else {
            nonOverlappingFields.push(field);
          }
        }

        to.fields = [...to.fields, ...nonOverlappingFields];
        if (overlappingFields.length > 0) {
          this.log(
            `overlapping fields in refinement: ${overlappingFields.map(
              extractName
            )}`
          );
        }
      }
    }

    return {
      segment: to,
      outputSpace: () =>
        new StaticSpace(
          opOutputStruct(this.reference, inputFS.structDef(), to)
        ),
    };
  }

  getFieldDef(fs: FieldSpace): TurtleDef {
    // TODO annotations
    return {
      type: 'turtle',
      name: this.reference.nameString,
      pipeline: this.pipeline(fs),
    };
  }

  makeEntry(fs: DynamicSpace) {
    const name = this.reference.nameString;
    const qf = new ViewField(fs, this, name);
    fs.newEntry(name, this, qf);
  }
}

function extractName(f1: QueryFieldDef | string): string {
  return typeof f1 === 'string' ? f1 : f1.as ?? f1.name;
}
