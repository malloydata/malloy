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

import { NamedQuery } from "../../../model/malloy_types";

import { ModelDataRequest } from "../../translate-response";

import {
  DocStatement,
  Document,
  MalloyElement,
  RunList
} from "../types/malloy-element";
import { QueryElement } from "../types/query-element";

export class DefineQuery extends MalloyElement implements DocStatement {
  elementType = "defineQuery";

  constructor(readonly name: string, readonly queryDetails: QueryElement) {
    super({ "queryDetails": queryDetails });
  }

  execute(doc: Document): ModelDataRequest {
    const entry: NamedQuery = {
      ...this.queryDetails.query(),
      "type": "query",
      "name": this.name,
      "location": this.location
    };
    const exported = false;
    doc.setEntry(this.name, { entry, exported });
    return undefined;
  }
}

export class DefineQueryList extends RunList implements DocStatement {
  constructor(queryList: DefineQuery[]) {
    super("defineQueries", queryList);
  }

  execute(doc: Document): ModelDataRequest {
    return this.executeList(doc);
  }
}
