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

import {PipeSegment, QueryFieldDef} from '../../../model/malloy_types';
import {FieldSpace} from '../types/field-space';
import {MalloyElement} from '../types/malloy-element';
import {OpDesc} from '../types/op-desc';
import {getFinalStruct, opOutputStruct} from '../struct-utils';
import {StaticSpace} from '../field-space/static-space';
import {LegalRefinementStage} from '../types/query-property-interface';
import {ViewFieldReference} from '../query-items/field-references';
import {QOPDesc} from './qop-desc';
import {SpaceField} from '../types/space-field';
import {QuerySpace} from '../field-space/query-spaces';

export abstract class Refinement extends MalloyElement {
  /**
   * @param inputFS
   * @param pipeline
   * @param isNestIn The pipeline being refined is a nest, and this is the space which contains the nest statement
   */
  abstract refine(
    inputFS: FieldSpace,
    pipeline: PipeSegment[],
    isNestIn: QuerySpace | undefined
  ): PipeSegment[];

  static from(base: QOPDesc | ViewFieldReference) {
    return base instanceof QOPDesc
      ? new QOPDescRefinement(base)
      : new NamedRefinement(base);
  }
}

export class NamedRefinement extends Refinement {
  elementType = 'namedRefinement';
  constructor(private readonly name: ViewFieldReference) {
    super({name});
  }

  private getRefinementSegment(fs: FieldSpace): PipeSegment | undefined {
    const res = this.name.getField(fs);
    if (!res.found) {
      this.name.log(`no such view \`${this.name.refString}\``);
      return;
    }
    if (res.found instanceof SpaceField) {
      const fieldDef = res.found.fieldDef();
      if (fieldDef?.type === 'turtle') {
        if (fieldDef.pipeline.length > 1 || fieldDef.pipeHead !== undefined) {
          this.name.log(
            `named refinement \`${this.name.refString}\` must have exactly one stage`
          );
          return;
        }
        if (this.name.list.length > 1) {
          this.log('Cannot use view from join as refinement');
          return;
        }
        return fieldDef.pipeline[0];
      }
      if (fieldDef?.type !== 'struct') {
        if (this.name.inExperiment('scalar_lenses', true)) {
          return {type: 'reduce', fields: [this.name.refString]};
        }
      }
    }
    this.name.log(
      `named refinement \`${this.name.refString}\` must be a view, found a ${
        res.found.typeDesc().dataType
      }`
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
      this.name.log('Named refinements of multi-stage views are not supported');
      // TODO better error pipeline?
      return pipeline;
    }
  }

  getOp(inputFS: FieldSpace, refineTo: PipeSegment): OpDesc {
    const to = {...refineTo};
    const from = this.getRefinementSegment(inputFS);
    if (from) {
      // TODO need to disallow partial + index for now to make the types happy
      if (to.type === 'partial' && from.type !== 'index') {
        to.type = from.type;
      } else if (from.type !== to.type) {
        this.log(`cannot refine ${to.type} view with ${from.type} view`);
      }

      if (from.type !== 'index' && to.type !== 'index') {
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

    return {
      segment: to,
      outputSpace: () =>
        new StaticSpace(opOutputStruct(this.name, inputFS.structDef(), to)),
    };
  }
}

function extractName(f1: QueryFieldDef | string): string {
  return typeof f1 === 'string' ? f1 : f1.as ?? f1.name;
}

export class QOPDescRefinement extends Refinement {
  elementType = 'qopdescRefinement';
  constructor(private readonly qOpDesc: QOPDesc) {
    super({qOpDesc});
  }

  private getOp(
    inputFS: FieldSpace,
    isNestIn: QuerySpace | undefined,
    qOpDesc: QOPDesc,
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
    if (pipeline.length === 1) {
      this.qOpDesc.refineFrom(pipeline[0]);
      return [this.getOp(inputFS, isNestIn, this.qOpDesc, pipeline[0])];
    }
    const headRefinements = new QOPDesc([]);
    const tailRefinements = new QOPDesc([]);
    for (const qop of this.qOpDesc.list) {
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
