/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import * as model from "../../model/malloy_types";
import {
  ColumnSpaceField,
  DefinedParameter,
  QueryFieldStruct,
} from "../space-field";
import { StaticSpace } from "../field-space";
import { FieldName } from "../ast";

/*
 **  A set of tests to make sure structdefs can become fieldspaces
 ** and the fieldspace produces the same strcutdef
 */

describe("structdef comprehension", () => {
  function mkStructDef(field: model.FieldDef): model.StructDef {
    return {
      type: "struct",
      name: "test",
      dialect: "standardsql",
      structSource: { type: "table" },
      structRelationship: { type: "basetable", connectionName: "test" },
      fields: [field],
    };
  }

  function fieldRef(fieldPath: string): FieldName[] {
    return fieldPath.split(".").map((name) => new FieldName(name));
  }

  test(`import string field`, () => {
    const field: model.FieldDef = {
      name: "t",
      type: "string",
    };
    const struct = mkStructDef(field);
    const space = new StaticSpace(struct);
    expect(space.lookup(fieldRef("t")).found).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test(`import float field`, () => {
    const field: model.FieldDef = {
      name: "t",
      type: "number",
      numberType: "float",
    };
    const struct = mkStructDef(field);
    const space = new StaticSpace(struct);
    expect(space.lookup(fieldRef("t")).found).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test(`import integer field`, () => {
    const field: model.FieldDef = {
      name: "t",
      type: "number",
      numberType: "integer",
    };
    const struct = mkStructDef(field);
    const space = new StaticSpace(struct);
    expect(space.lookup(fieldRef("t")).found).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test(`import boolean field`, () => {
    const field: model.FieldDef = {
      name: "t",
      type: "boolean",
    };
    const struct = mkStructDef(field);
    const space = new StaticSpace(struct);
    expect(space.lookup(fieldRef("t")).found).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test(`import nested field`, () => {
    const field: model.FieldDef = {
      name: "t",
      type: "struct",
      dialect: "standardsql",
      structRelationship: { type: "nested", field: "a" },
      structSource: { type: "nested" },
      fields: [{ type: "string", name: "b" }],
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
      name: "t",
      type: "struct",
      dialect: "standardsql",
      structRelationship: { type: "inline" },
      structSource: { type: "inline" },
      fields: [{ type: "string", name: "a" }],
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
      name: "t",
      type: "struct",
      dialect: "standardsql",
      structRelationship: {
        type: "one",
        onExpression: [
          { type: "field", path: "aKey" },
          "=",
          { type: "field", path: "t.a" },
        ],
      },
      structSource: { type: "table" },
      fields: [{ type: "string", name: "a" }],
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
      name: "t",
      type: "turtle",
      pipeline: [
        {
          type: "reduce",
          fields: ["a"],
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
    const struct = mkStructDef({ name: "f", type: "string" });
    struct.parameters = {
      cReqStr: {
        name: "cReqStr",
        type: "string",
        value: null,
        constant: false,
      },
      cOptStr: {
        name: "cOptStr",
        type: "string",
        value: ["value"],
        constant: false,
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
