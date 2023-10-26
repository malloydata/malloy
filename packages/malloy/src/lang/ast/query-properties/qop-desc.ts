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
import {QueryBuilder} from '../types/query-builder';
import {IndexBuilder} from '../query-builders/index-builder';
import {ProjectBuilder} from '../query-builders/project-builder';
import {ReduceBuilder} from '../query-builders/reduce-builder';
import {FieldSpace} from '../types/field-space';
import {ListOf, MalloyElement} from '../types/malloy-element';
import {OpDesc} from '../types/op-desc';
import {getFinalStruct, opOutputStruct} from '../struct-utils';
import {QueryProperty} from '../types/query-property';
import {StaticSpace} from '../field-space/static-space';
import {
  LegalRefinementStage,
  QueryClass,
} from '../types/query-property-interface';
import {QueryInputSpace} from '../field-space/query-input-space';
import {QueryFieldStruct} from '../field-space/query-field-struct';
import {ViewFieldReference} from '../query-items/field-references';
import {QueryFieldAST} from './nest';

export abstract class Refinement extends MalloyElement {
  abstract refine(inputFS: FieldSpace, pipeline: PipeSegment[]): PipeSegment[];
}

export class NamedRefinement extends Refinement {
  elementType = 'namedRefinement';
  constructor(private readonly name: ViewFieldReference) {
    super();
  }

  private getRefinementSegment(fs: FieldSpace): PipeSegment | undefined {
    const res = this.name.getField(fs);
    if (!res.found) {
      this.name.log(`no such view \`${this.name.refString}\``);
      return;
    }
    // TODO check type of pipeline?
    if (
      res.found instanceof QueryFieldStruct ||
      res.found instanceof QueryFieldAST
    ) {
      const turtleDef = res.found.fieldDef();
      if (turtleDef.pipeline.length > 1 || turtleDef.pipeHead !== undefined) {
        this.name.log(
          `named refinement \`${this.name.refString}\` must have exactly one stage`
        );
        return;
      }
      return turtleDef.pipeline[0];
    } else {
      this.name.log(
        `named refinement \`${this.name.refString}\` must be a view, found a ${
          res.found.describeType().dataType
        }`
      );
      return;
    }
  }

  refine(inputFS: FieldSpace, pipeline: PipeSegment[]): PipeSegment[] {
    if (pipeline.length === 1) {
      return [this.getOp(inputFS, pipeline[0]).segment];
    } else {
      this.name.log('Named refinements of multi-stage views are not supported');
      // TODO better error pipeline?
      return pipeline;
    }
  }

  getOp(inputFS: FieldSpace, _to: PipeSegment): OpDesc {
    const to = {..._to};
    const from = this.getRefinementSegment(inputFS);
    if (from) {
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
    super();
  }

  private getOp(
    inputFS: FieldSpace,
    headFS: QueryInputSpace | undefined,
    qOpDesc: QOPDesc,
    refineThis: PipeSegment
  ): PipeSegment {
    qOpDesc.refineFrom(refineThis);
    return qOpDesc.getOp(inputFS, headFS).segment;
  }

  refine(inputFS: FieldSpace, _pipeline: PipeSegment[]): PipeSegment[] {
    const pipeline = [..._pipeline];
    if (pipeline.length === 1) {
      this.qOpDesc.refineFrom(pipeline[0]);
      return [this.getOp(inputFS, undefined, this.qOpDesc, pipeline[0])];
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

export class QOPDesc extends ListOf<QueryProperty> {
  elementType = 'queryOperation';
  opClass = QueryClass.Grouping;
  private refineThis?: PipeSegment;

  protected computeType(): QueryClass {
    let mustBe: QueryClass | undefined;
    if (this.refineThis) {
      if (this.refineThis.type === 'reduce') {
        mustBe = QueryClass.Grouping;
      } else if (this.refineThis.type === 'project') {
        mustBe = QueryClass.Project;
      } else {
        mustBe = QueryClass.Index;
      }
    }
    for (const el of this.list) {
      if (el.forceQueryClass) {
        if (mustBe) {
          if (mustBe !== el.forceQueryClass) {
            el.log(`Not legal in ${mustBe} query`);
          }
        } else {
          mustBe = el.forceQueryClass;
        }
      }
    }
    if (mustBe === undefined) {
      this.log(
        "Can't determine query type (group_by/aggregate/nest,project,index)"
      );
    }
    const guessType = mustBe || QueryClass.Grouping;
    this.opClass = guessType;
    return guessType;
  }

  refineFrom(existing: PipeSegment): void {
    this.refineThis = existing;
  }

  private getBuilder(baseFS: FieldSpace): QueryBuilder {
    switch (this.computeType()) {
      case QueryClass.Grouping:
        return new ReduceBuilder(baseFS, this.refineThis);
      case QueryClass.Project:
        return new ProjectBuilder(baseFS, this.refineThis);
      case QueryClass.Index:
        return new IndexBuilder(baseFS, this.refineThis);
    }
  }

  getOp(
    inputFS: FieldSpace,
    headFieldSpace: QueryInputSpace | undefined
  ): OpDesc {
    const build = this.getBuilder(inputFS);
    if (headFieldSpace) {
      build.inputFS.nestParent = headFieldSpace;
    }
    build.resultFS.astEl = this;
    for (const qp of this.list) {
      build.execute(qp);
    }
    const segment = build.finalize(this.refineThis);
    return {
      segment,
      outputSpace: () =>
        // TODO someday we'd like to get rid of the call to opOutputStruct here.
        // If the `qex.resultFS` is correct, then we should be able to just use that
        // in a more direct way.
        new StaticSpace(opOutputStruct(this, inputFS.structDef(), segment)),
    };
  }
}
