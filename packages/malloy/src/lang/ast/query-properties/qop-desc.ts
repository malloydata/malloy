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
import {PipelineDesc} from '../elements/pipeline-desc';
import {Aggregate} from './aggregate';
import {GroupBy} from './group-by';
import {Index} from './indexing';
import {Nests} from './nests';
import {ProjectStatement} from './project-statement';
import {opOutputStruct} from '../struct-utils';
import {QueryProperty} from '../types/query-property';
import {isNestedQuery} from './nest';
import {StaticSpace} from '../field-space/static-space';

type QOPType = 'grouping' | 'aggregate' | 'project' | 'index';

export class QOPDesc extends ListOf<QueryProperty> {
  elementType = 'queryOperation';
  opType: QOPType = 'grouping';
  private refineThis?: PipeSegment;
  constructor(props: QueryProperty[]) {
    super(props);
  }

  protected computeType(): QOPType {
    let firstGuess: QOPType | undefined;
    if (this.refineThis) {
      if (this.refineThis.type === 'reduce') {
        firstGuess = 'grouping';
      } else {
        firstGuess = this.refineThis.type;
      }
    }
    let anyGrouping = false;
    for (const el of this.list) {
      if (el instanceof Index) {
        firstGuess ||= 'index';
        if (firstGuess !== 'index') {
          el.log(`index: not legal in ${firstGuess} query`);
        }
      } else if (
        el instanceof Nests ||
        isNestedQuery(el) ||
        el instanceof GroupBy
      ) {
        firstGuess ||= 'grouping';
        anyGrouping = true;
        if (firstGuess === 'project' || firstGuess === 'index') {
          el.log(`group_by: not legal in ${firstGuess} query`);
        }
      } else if (el instanceof Aggregate) {
        firstGuess ||= 'aggregate';
        if (firstGuess === 'project' || firstGuess === 'index') {
          el.log(`aggregate: not legal in ${firstGuess} query`);
        }
      } else if (el instanceof ProjectStatement) {
        firstGuess ||= 'project';
        if (firstGuess !== 'project') {
          el.log(`project: not legal in ${firstGuess} query`);
        }
      }
    }
    if (firstGuess === 'aggregate' && anyGrouping) {
      firstGuess = 'grouping';
    }
    if (!firstGuess) {
      this.log(
        "Can't determine query type (group_by/aggregate/nest,project,index)"
      );
    }
    const guessType = firstGuess || 'grouping';
    this.opType = guessType;
    return guessType;
  }

  refineFrom(existing: PipeSegment): void {
    this.refineThis = existing;
  }

  private getExecutor(baseFS: FieldSpace): Executor {
    switch (this.computeType()) {
      case 'aggregate':
      case 'grouping':
        return new ReduceExecutor(baseFS, this.refineThis);
      case 'project':
        return new ProjectExecutor(baseFS, this.refineThis);
      case 'index':
        return new IndexExecutor(baseFS, this.refineThis);
    }
  }

  getOp(inputFS: FieldSpace, forPipeline: PipelineDesc | null): OpDesc {
    const qex = this.getExecutor(inputFS);
    if (forPipeline?.nestedInQuerySpace) {
      qex.inputFS.nestParent = forPipeline.nestedInQuerySpace;
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
