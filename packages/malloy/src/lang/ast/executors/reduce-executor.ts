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
  FilterExpression,
  isReduceSegment,
  PipeSegment,
  QuerySegment,
  ReduceSegment,
} from "../../../model/malloy_types";

import { ErrorFactory } from "../error-factory";
import { FieldSpace } from "../types/field-space";
import { Aggregate } from "../query-properties/aggregate";
import { DeclareFields } from "../query-properties/declare-fields";
import { Filter } from "../query-properties/filters";
import { GroupBy } from "../query-properties/group-by";
import { Joins } from "../query-properties/joins";
import { Limit } from "../query-properties/limit";
import { Ordering } from "../query-properties/ordering";
import { Top } from "../query-properties/top";
import { QueryProperty } from "../types/query-property";
import { Executor } from "../types/executor";
import { Nests } from "../query-properties/nests";
import { isNestedQuery } from "../query-properties/nest";
import {
  QueryInputSpace,
  QuerySpace,
  ReduceFieldSpace,
} from "../field-space/query-spaces";
import { DynamicSpace } from "../field-space/dynamic-space";

export class ReduceExecutor implements Executor {
  inputFS: QueryInputSpace;
  resultFS: QuerySpace;
  filters: FilterExpression[] = [];
  order?: Top | Ordering;
  limit?: number;
  refinedInputFS?: DynamicSpace;

  constructor(baseFS: FieldSpace) {
    this.resultFS = this.getResultSpace(baseFS);
    this.inputFS = this.resultFS.exprSpace;
  }

  getResultSpace(fs: FieldSpace): QuerySpace {
    return new ReduceFieldSpace(fs);
  }

  execute(qp: QueryProperty): void {
    if (
      qp instanceof GroupBy ||
      qp instanceof Aggregate ||
      qp instanceof Nests
    ) {
      this.resultFS.addQueryItems(...qp.list);
    } else if (isNestedQuery(qp)) {
      this.resultFS.addQueryItems(qp);
    } else if (qp instanceof Filter) {
      this.filters.push(...qp.getFilterList(this.inputFS));
    } else if (qp instanceof Top) {
      if (this.limit) {
        qp.log("Query operation already limited");
      } else {
        this.limit = qp.limit;
      }
      if (qp.by) {
        if (this.order) {
          qp.log("Query operation is already sorted");
        } else {
          this.order = qp;
        }
      }
    } else if (qp instanceof Limit) {
      if (this.limit) {
        qp.log("Query operation already limited");
      } else {
        this.limit = qp.limit;
      }
    } else if (qp instanceof Ordering) {
      if (this.order) {
        qp.log("Query operation already sorted");
      } else {
        this.order = qp;
      }
    } else if (qp instanceof Joins || qp instanceof DeclareFields) {
      for (const qel of qp.list) {
        this.inputFS.extendSource(qel);
      }
    }
  }

  refineFrom(from: PipeSegment | undefined, to: QuerySegment): void {
    if (from && from.type !== "index") {
      if (!this.order) {
        if (from.orderBy) {
          to.orderBy = from.orderBy;
        } else if (from.by) {
          to.by = from.by;
        }
      }
      if (!this.limit && from.limit) {
        to.limit = from.limit;
      }
    }

    if (this.limit) {
      to.limit = this.limit;
    }

    if (this.order instanceof Top) {
      const topBy = this.order.getBy(this.resultFS);
      if (topBy) {
        to.by = topBy;
      }
    }
    if (this.order instanceof Ordering) {
      to.orderBy = this.order.getOrderBy(this.resultFS);
    }

    const oldFilters = from?.filterList || [];
    if (this.filters.length > 0 && !oldFilters) {
      to.filterList = this.filters;
    } else if (oldFilters) {
      to.filterList = [...oldFilters, ...this.filters];
    }
  }

  finalize(fromSeg: PipeSegment | undefined): PipeSegment {
    let from: ReduceSegment | undefined;
    if (fromSeg) {
      if (isReduceSegment(fromSeg)) {
        from = fromSeg;
      } else {
        this.inputFS.result.log(`Can't refine reduce with ${fromSeg.type}`);
        return ErrorFactory.reduceSegment;
      }
    }
    const reduceSegment = this.resultFS.getQuerySegment(from);
    this.refineFrom(from, reduceSegment);

    return reduceSegment;
  }
}
