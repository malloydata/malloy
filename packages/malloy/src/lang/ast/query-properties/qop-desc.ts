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

import {PipeSegment} from '../../../model/malloy_types';
import {Executor} from '../types/executor';
import {IndexExecutor} from '../executors/index-executor';
import {ProjectExecutor} from '../executors/project-executor';
import {ReduceExecutor} from '../executors/reduce-executor';
import {FieldSpace} from '../types/field-space';
import {ListOf} from '../types/malloy-element';
import {OpDesc} from '../types/op-desc';
import {opOutputStruct} from '../struct-utils';
import {QueryProperty} from '../types/query-property';
import {StaticSpace} from '../field-space/static-space';
import {QueryClass} from '../types/query-property-interface';
import {QueryInputSpace} from '../field-space/query-input-space';

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

  private getExecutor(baseFS: FieldSpace): Executor {
    switch (this.computeType()) {
      case QueryClass.Grouping:
        return new ReduceExecutor(baseFS, this.refineThis);
      case QueryClass.Project:
        return new ProjectExecutor(baseFS, this.refineThis);
      case QueryClass.Index:
        return new IndexExecutor(baseFS, this.refineThis);
    }
  }

  getOp(
    inputFS: FieldSpace,
    headFieldSpace: QueryInputSpace | undefined
  ): OpDesc {
    const qex = this.getExecutor(inputFS);
    if (headFieldSpace) {
      qex.inputFS.nestParent = headFieldSpace;
    }
    qex.resultFS.astEl = this;
    for (const qp of this.list) {
      qex.execute(qp);
    }
    const segment = qex.finalize(this.refineThis);
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
