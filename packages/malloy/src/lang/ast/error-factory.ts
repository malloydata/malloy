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

/*
 ** For times when there is a code generation error but your function needs
 ** to return some kind of object to type properly, the ErrorFactory is
 ** here to help you.
 */

import {
  IndexSegment,
  ProjectSegment,
  Query,
  ReduceSegment,
  StructDef,
} from "../../model/malloy_types";

const theErrorStruct: StructDef = {
  "type": "struct",
  "name": "~malformed~",
  "dialect": "~malformed~",
  "structSource": {
    "type": "table",
    "tablePath": "//undefined_error_table_path",
  },
  "structRelationship": {
    "type": "basetable",
    "connectionName": "//undefined_error_connection",
  },
  "fields": [],
};

export class ErrorFactory {
  static get structDef(): StructDef {
    return { ...theErrorStruct };
  }

  static isErrorStructDef(s: StructDef): boolean {
    return s.name.includes(theErrorStruct.name);
  }

  static get query(): Query {
    return {
      "structRef": ErrorFactory.structDef,
      "pipeline": [],
    };
  }

  static get reduceSegment(): ReduceSegment {
    return { "type": "reduce", "fields": [] };
  }

  static get projectSegment(): ProjectSegment {
    return { "type": "project", "fields": [] };
  }

  static get indexSegment(): IndexSegment {
    return { "type": "index", "fields": [] };
  }
}
