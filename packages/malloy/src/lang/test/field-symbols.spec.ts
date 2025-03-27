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

import type * as model from '../../model/malloy_types';
import {StaticSourceSpace} from '../ast/field-space/static-space';
import {ColumnSpaceField} from '../ast/field-space/column-space-field';
import {FieldName} from '../ast/types/field-space';
import {IRViewField} from '../ast/field-space/ir-view-field';
import {DefinedParameter} from '../ast/types/space-param';

/*
 **  A set of tests to make sure structdefs can become fieldspaces
 ** and the fieldspace produces the same strcutdef
 */

describe('structdef comprehension', () => {
  function mkStructDef(field: model.FieldDef): model.SourceDef {
    return {
      type: 'table',
      name: 'test',
      dialect: 'standardsql',
      tablePath: 'test',
      connection: 'test',
      fields: [field],
    };
  }

  function fieldRef(fieldPath: string): FieldName[] {
    return fieldPath.split('.').map(name => new FieldName(name));
  }

  test('import string field', () => {
    const field: model.FieldDef = {
      name: 't',
      type: 'string',
    };
    const struct = mkStructDef(field);
    const space = new StaticSourceSpace(struct);
    expect(space.lookup(fieldRef('t')).found).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test('import float field', () => {
    const field: model.FieldDef = {
      name: 't',
      type: 'number',
      numberType: 'float',
    };
    const struct = mkStructDef(field);
    const space = new StaticSourceSpace(struct);
    expect(space.lookup(fieldRef('t')).found).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test('import integer field', () => {
    const field: model.FieldDef = {
      name: 't',
      type: 'number',
      numberType: 'integer',
    };
    const struct = mkStructDef(field);
    const space = new StaticSourceSpace(struct);
    expect(space.lookup(fieldRef('t')).found).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test('import boolean field', () => {
    const field: model.FieldDef = {
      name: 't',
      type: 'boolean',
    };
    const struct = mkStructDef(field);
    const space = new StaticSourceSpace(struct);
    expect(space.lookup(fieldRef('t')).found).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test('import unsupported field', () => {
    const field: model.FieldDef = {
      name: 't',
      type: 'sql native',
    };
    const struct = mkStructDef(field);
    const space = new StaticSourceSpace(struct);
    expect(space.lookup(fieldRef('t')).found).toBeInstanceOf(ColumnSpaceField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test('import repeated record', () => {
    const field: model.ScalarArrayDef = {
      name: 't',
      type: 'array',
      elementTypeDef: {type: 'string'},
      join: 'many',
      matrixOperation: 'left',
      fields: [{type: 'string', name: 'b'}],
    };
    const struct = mkStructDef(field);
    const space = new StaticSourceSpace(struct);
    expect(space.lookup(fieldRef('t.b')).found).toBeInstanceOf(
      ColumnSpaceField
    );
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test('import inline field', () => {
    const field: model.RecordDef = {
      name: 't',
      type: 'record',
      join: 'one',
      matrixOperation: 'left',
      fields: [{type: 'string', name: 'a'}],
    };
    const struct = mkStructDef(field);
    const space = new StaticSourceSpace(struct);
    expect(space.lookup(fieldRef('t.a')).found).toBeInstanceOf(
      ColumnSpaceField
    );
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test('import join field', () => {
    const field: model.FieldDef = {
      name: 't',
      type: 'table',
      dialect: 'standardsql',
      connection: 'test',
      join: 'one',
      matrixOperation: 'left',
      onExpression: {
        node: '=',
        kids: {
          left: {node: 'field', path: ['aKey']},
          right: {node: 'field', path: ['t', 'a']},
        },
      },
      tablePath: 't',
      fields: [{type: 'string', name: 'a'}],
    };
    const struct = mkStructDef(field);
    const space = new StaticSourceSpace(struct);
    expect(space.lookup(fieldRef('t.a')).found).toBeInstanceOf(
      ColumnSpaceField
    );
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test('import query stage field', () => {
    const field: model.TurtleDef = {
      name: 't',
      type: 'turtle',
      pipeline: [
        {
          type: 'reduce',
          queryFields: [{type: 'fieldref', path: ['a']}],
        },
      ],
    };
    const struct = mkStructDef(field);
    const space = new StaticSourceSpace(struct);
    expect(space.lookup(fieldRef('t')).found).toBeInstanceOf(IRViewField);
    const oField = space.structDef().fields[0];
    expect(oField).toEqual(field);
  });

  test('import struct with parameters', () => {
    const struct = mkStructDef({name: 'f', type: 'string'});
    struct.parameters = {
      cReqStr: {
        name: 'cReqStr',
        type: 'string',
        value: null,
      },
      cOptStr: {
        name: 'cOptStr',
        type: 'string',
        value: {node: 'stringLiteral', literal: 'value'},
      },
    };
    const space = new StaticSourceSpace(struct);
    expect(space.lookup(fieldRef('cReqStr')).found).toBeInstanceOf(
      DefinedParameter
    );
    expect(space.lookup(fieldRef('cOptStr')).found).toBeInstanceOf(
      DefinedParameter
    );
  });
});
