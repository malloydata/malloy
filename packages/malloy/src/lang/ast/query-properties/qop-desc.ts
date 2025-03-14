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

import type {PipeSegment} from '../../../model/malloy_types';
import type {QueryBuilder} from '../types/query-builder';
import {IndexBuilder} from '../query-builders/index-builder';
import {ProjectBuilder} from '../query-builders/project-builder';
import {ReduceBuilder} from '../query-builders/reduce-builder';
import type {SourceFieldSpace} from '../types/field-space';
import type {MalloyElement} from '../types/malloy-element';
import {ListOf} from '../types/malloy-element';
import type {OpDesc} from '../types/op-desc';
import {opOutputStruct} from '../struct-utils';
import type {QueryProperty} from '../types/query-property';
import {StaticSourceSpace} from '../field-space/static-space';
import {QueryClass} from '../types/query-property-interface';
import {PartialBuilder} from '../query-builders/partial-builder';
import type {QueryOperationSpace} from '../field-space/query-spaces';

export class QOpDesc extends ListOf<QueryProperty> {
  elementType = 'queryOperation';
  opClass: QueryClass | undefined;
  private refineThis?: PipeSegment;

  protected computeType(): QueryClass | undefined {
    let guessType: QueryClass | undefined;
    let needsExplicitQueryClass = false;
    if (this.refineThis) {
      if (this.refineThis.type === 'reduce') {
        guessType = QueryClass.Grouping;
      } else if (this.refineThis.type === 'project') {
        guessType = QueryClass.Project;
      } else if (this.refineThis.type === 'index') {
        guessType = QueryClass.Index;
      }
    }
    for (const el of this.list) {
      if (el.forceQueryClass) {
        if (guessType) {
          if (guessType !== el.forceQueryClass) {
            el.logError(
              `illegal-${guessType}-operation`,
              `Not legal in ${guessType} query`
            );
          }
        } else {
          guessType = el.forceQueryClass;
        }
      }
      needsExplicitQueryClass ||= el.needsExplicitQueryClass ?? false;
    }
    if (guessType === undefined && needsExplicitQueryClass) {
      this.logError('ambiguous-view-type', {});
      guessType = QueryClass.Project;
    }
    this.opClass = guessType;
    return guessType;
  }

  refineFrom(existing: PipeSegment): void {
    this.refineThis = existing;
  }

  private getBuilder(
    baseFS: SourceFieldSpace,
    isNestIn: QueryOperationSpace | undefined,
    astEl: MalloyElement
  ): QueryBuilder {
    switch (this.computeType()) {
      case QueryClass.Grouping:
        return new ReduceBuilder(baseFS, this.refineThis, isNestIn, astEl);
      case QueryClass.Project:
        return new ProjectBuilder(baseFS, this.refineThis, isNestIn, astEl);
      case QueryClass.Index:
        return new IndexBuilder(baseFS, this.refineThis, isNestIn, astEl);
      case undefined:
        return new PartialBuilder(baseFS, this.refineThis, isNestIn, astEl);
    }
  }

  getOp(
    inputFS: SourceFieldSpace,
    isNestIn: QueryOperationSpace | undefined
  ): OpDesc {
    const build = this.getBuilder(inputFS, isNestIn, this);
    for (const qp of this.list) {
      build.execute(qp);
    }
    const segment = build.finalize(this.refineThis);
    return {
      segment,
      outputSpace: () =>
        // TODO someday we'd like to get rid of the call to opOutputStruct here.
        // If the `build.resultFS` is correct, then we should be able to just use that
        // in a more direct way.
        new StaticSourceSpace(
          opOutputStruct(this, inputFS.structDef(), segment)
        ),
    };
  }
}
