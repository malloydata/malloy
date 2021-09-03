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

import * as model from "../model/malloy_types";
import { FieldSpace } from "./field-space";
import { ColumnSpaceField, DefinedParameter, TurtleFieldStruct } from "./space-field";

/*
 **  A set of tests to make sure structdefs can become fieldspaces
 ** and the fieldspace produces the same strcutdef
 */

describe("structdef comprehension", () => {
  function mkStructDef(field: model.FieldDef): model.StructDef {
    return {
      type: "struct",
      name: "test",
      structSource: { type: "table" },
      structRelationship: { type: "basetable" },
      fields: [field],
    };
  }

  test(`import string field`, () => {
    const field: model.FieldDef = {
      name: "t",
      type: "string",
    };
    const struct = mkStructDef(field);
    const space = new FieldSpace(struct);
    expect(space.findEntry("t")).toBeInstanceOf(ColumnSpaceField);
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
    const space = new FieldSpace(struct);
    expect(space.findEntry("t")).toBeInstanceOf(ColumnSpaceField);
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
    const space = new FieldSpace(struct);
    expect(space.findEntry("t")).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test(`import boolean field`, () => {
    const field: model.FieldDef = {
      name: "t",
      type: "boolean",
    };
    const struct = mkStructDef(field);
    const space = new FieldSpace(struct);
    expect(space.findEntry("t")).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  // LTNOTE: I think we just need to remove these they no longer exist.

  // test(`import count field`, () => {
  //   const field: model.FieldDef = {
  //     name: "t",
  //     type: "count",
  //   };
  //   const struct = mkStructDef(field);
  //   const space = new FieldSpace(struct);
  //   expect(space.field("t")).toBeInstanceOf(ColumnSpaceField);
  //   const oField = space.structDef().fields[0];
  //   expect(oField).toEqual(field);
  // });

  // test(`import count_distinct field`, () => {
  //   const field: model.FieldDef = {
  //     name: "t",
  //     type: "count_distinct",
  //     e: ["a"],
  //   };
  //   const struct = mkStructDef(field);
  //   const space = new FieldSpace(struct);
  //   expect(space.field("t")).toBeInstanceOf(ColumnSpaceField);
  //   const oField = space.structDef().fields[0];
  //   expect(oField).toEqual(field);
  // });

  // test(`import sum field`, () => {
  //   const field: model.FieldDef = {
  //     name: "t",
  //     type: "sum",
  //     e: ["a"],
  //   };
  //   const struct = mkStructDef(field);
  //   const space = new FieldSpace(struct);
  //   expect(space.field("t")).toBeInstanceOf(ColumnSpaceField);
  //   const oField = space.structDef().fields[0];
  //   expect(oField).toEqual(field);
  // });

  test(`import nested field`, () => {
    const field: model.FieldDef = {
      name: "t",
      type: "struct",
      structRelationship: { type: "nested", field: "a" },
      structSource: { type: "nested" },
      fields: [{ type: "string", name: "b" }],
    };
    const struct = mkStructDef(field);
    const space = new FieldSpace(struct);
    expect(space.findEntry("t.b")).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test(`import inline field`, () => {
    const field: model.FieldDef = {
      name: "t",
      type: "struct",
      structRelationship: { type: "inline" },
      structSource: { type: "inline" },
      fields: [{ type: "string", name: "a" }],
    };
    const struct = mkStructDef(field);
    const space = new FieldSpace(struct);
    expect(space.findEntry("t.a")).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test(`import join field`, () => {
    const field: model.FieldDef = {
      name: "t",
      type: "struct",
      structRelationship: { type: "foreignKey", foreignKey: "b" },
      structSource: { type: "table" },
      fields: [{ type: "string", name: "a" }],
    };
    const struct = mkStructDef(field);
    const space = new FieldSpace(struct);
    expect(space.findEntry("t.a")).toBeInstanceOf(ColumnSpaceField);
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
    const space = new FieldSpace(struct);
    expect(space.findEntry("t")).toBeInstanceOf(TurtleFieldStruct);
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
      },
      cOptStr: {
        name: "cOptStr",
        type: "string",
        value: ["value"],
      },
    };
    const space = new FieldSpace(struct);
    expect(space.findEntry("cReqStr")).toBeInstanceOf(DefinedParameter);
    expect(space.findEntry("cOptStr")).toBeInstanceOf(DefinedParameter);
  });
});
