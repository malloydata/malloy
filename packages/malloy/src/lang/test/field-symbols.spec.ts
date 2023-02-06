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

import * as model from "../../model/malloy_types";
import { StaticSpace } from "../ast/field-space/static-space";
import { ColumnSpaceField } from "../ast/field-space/column-space-field";
import { FieldName } from "../ast/types/field-space";
import { QueryFieldStruct } from "../ast/field-space/query-field-struct";
import { DefinedParameter } from "../ast/types/space-param";

/*
 **  A set of tests to make sure structdefs can become fieldspaces
 ** and the fieldspace produces the same strcutdef
 */

describe("structdef comprehension", () => {
  function mkStructDef(field: model.FieldDef): model.StructDef {
    return {
      "type": "struct",
      "name": "test",
      "dialect": "standardsql",
      "structSource": { "type": "table", "tablePath": "test" },
      "structRelationship": { "type": "basetable", "connectionName": "test" },
      "fields": [field],
    };
  }

  function fieldRef(fieldPath: string): FieldName[] {
    return fieldPath.split(".").map((name) => new FieldName(name));
  }

  test(`import string field`, () => {
    const field: model.FieldDef = {
      "name": "t",
      "type": "string",
    };
    const struct = mkStructDef(field);
    const space = new StaticSpace(struct);
    expect(space.lookup(fieldRef("t")).found).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test(`import float field`, () => {
    const field: model.FieldDef = {
      "name": "t",
      "type": "number",
      "numberType": "float",
    };
    const struct = mkStructDef(field);
    const space = new StaticSpace(struct);
    expect(space.lookup(fieldRef("t")).found).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test(`import integer field`, () => {
    const field: model.FieldDef = {
      "name": "t",
      "type": "number",
      "numberType": "integer",
    };
    const struct = mkStructDef(field);
    const space = new StaticSpace(struct);
    expect(space.lookup(fieldRef("t")).found).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test(`import boolean field`, () => {
    const field: model.FieldDef = {
      "name": "t",
      "type": "boolean",
    };
    const struct = mkStructDef(field);
    const space = new StaticSpace(struct);
    expect(space.lookup(fieldRef("t")).found).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test(`import nested field`, () => {
    const field: model.FieldDef = {
      "name": "t",
      "type": "struct",
      "dialect": "standardsql",
      "structRelationship": {
        "type": "nested",
        "field": "a",
        "isArray": false,
      },
      "structSource": { "type": "nested" },
      "fields": [{ "type": "string", "name": "b" }],
    };
    const struct = mkStructDef(field);
    const space = new StaticSpace(struct);
    expect(space.lookup(fieldRef("t.b")).found).toBeInstanceOf(
      ColumnSpaceField
    );
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test(`import inline field`, () => {
    const field: model.FieldDef = {
      "name": "t",
      "type": "struct",
      "dialect": "standardsql",
      "structRelationship": { "type": "inline" },
      "structSource": { "type": "inline" },
      "fields": [{ "type": "string", "name": "a" }],
    };
    const struct = mkStructDef(field);
    const space = new StaticSpace(struct);
    expect(space.lookup(fieldRef("t.a")).found).toBeInstanceOf(
      ColumnSpaceField
    );
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test(`import join field`, () => {
    const field: model.FieldDef = {
      "name": "t",
      "type": "struct",
      "dialect": "standardsql",
      "structRelationship": {
        "type": "one",
        "onExpression": [
          { "type": "field", "path": "aKey" },
          "=",
          { "type": "field", "path": "t.a" },
        ],
      },
      "structSource": { "type": "table", "tablePath": "t" },
      "fields": [{ "type": "string", "name": "a" }],
    };
    const struct = mkStructDef(field);
    const space = new StaticSpace(struct);
    expect(space.lookup(fieldRef("t.a")).found).toBeInstanceOf(
      ColumnSpaceField
    );
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test(`import query stage field`, () => {
    const field: model.TurtleDef = {
      "name": "t",
      "type": "turtle",
      "pipeline": [
        {
          "type": "reduce",
          "fields": ["a"],
        },
      ],
    };
    const struct = mkStructDef(field);
    const space = new StaticSpace(struct);
    expect(space.lookup(fieldRef("t")).found).toBeInstanceOf(QueryFieldStruct);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test("import struct with parameters", () => {
    const struct = mkStructDef({ "name": "f", "type": "string" });
    struct.parameters = {
      "cReqStr": {
        "name": "cReqStr",
        "type": "string",
        "value": null,
        "constant": false,
      },
      "cOptStr": {
        "name": "cOptStr",
        "type": "string",
        "value": ["value"],
        "constant": false,
      },
    };
    const space = new StaticSpace(struct);
    expect(space.lookup(fieldRef("cReqStr")).found).toBeInstanceOf(
      DefinedParameter
    );
    expect(space.lookup(fieldRef("cOptStr")).found).toBeInstanceOf(
      DefinedParameter
    );
  });
});
