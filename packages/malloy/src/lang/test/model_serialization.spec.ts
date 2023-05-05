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

import {StructDef} from '../../model/malloy_types';
import {Explore} from '../../malloy';

export const CHILD_EXPLORE: StructDef = {
  type: 'struct',
  name: 'some_ns.child',
  as: 'child',
  dialect: 'standardsql',
  structSource: {
    type: 'table',
    tablePath: 'some_ns.child',
  },
  structRelationship: {type: 'basetable', connectionName: 'bigquery'},
  primaryKey: 'id1',
  fields: [
    {type: 'string', name: 'carrier'},
    {
      type: 'number',
      name: 'flight_count',
      expressionType: 'aggregate',
      e: [{type: 'aggregate', function: 'count', e: []}],
    },
  ],
};

export const PARENT_EXPLORE: StructDef = {
  type: 'struct',
  name: 'some_ns.parent',
  as: 'parent',
  dialect: 'standardsql',
  structSource: {
    type: 'table',
    tablePath: 'some_ns.parent',
  },
  structRelationship: {type: 'basetable', connectionName: 'bigquery'},
  primaryKey: 'id2',
  fields: [
    {type: 'string', name: 'name'},
    {
      type: 'number',
      name: 'some_parent_count',
      expressionType: 'aggregate',
      e: [{type: 'aggregate', function: 'count', e: []}],
    },
  ],
};

export const GRADPARENT_EXPLORE: StructDef = {
  type: 'struct',
  name: 'some_ns.gradparent',
  as: 'parent',
  dialect: 'standardsql',
  structSource: {
    type: 'table',
    tablePath: 'some_ns.gradparent',
  },
  structRelationship: {type: 'basetable', connectionName: 'bigquery'},
  primaryKey: 'id3',
  fields: [
    {type: 'string', name: 'name'},
    {
      type: 'number',
      name: 'some_gradparent_count',
      expressionType: 'aggregate',
      e: [{type: 'aggregate', function: 'count', e: []}],
    },
  ],
};

export const SOURCE_EXPLORE: StructDef = {
  type: 'struct',
  name: 'some_ns.source',
  as: 'source',
  dialect: 'standardsql',
  structSource: {
    type: 'table',
    tablePath: 'some_ns.source',
  },
  structRelationship: {type: 'basetable', connectionName: 'bigquery'},
  primaryKey: 'id4',
  fields: [
    {type: 'string', name: 'name'},
    {
      type: 'number',
      name: 'some_child_count',
      expressionType: 'aggregate',
      e: [{type: 'aggregate', function: 'count', e: []}],
    },
  ],
};

describe('serializeModel', () => {
  test('Stringify on an `explore` with no parent nor source explore', async () => {
    const parent_explore = new Explore(PARENT_EXPLORE);
    expect(JSON.stringify(parent_explore)).toStrictEqual(
      '{"_structDef":{"type":"struct","name":"some_ns.parent","as":"parent","dialect":"standardsql","structSource":{"type":"table","tablePath":"some_ns.parent"},"structRelationship":{"type":"basetable","connectionName":"bigquery"},"primaryKey":"id2","fields":[{"type":"string","name":"name"},{"type":"number","name":"some_parent_count","expressionType":"aggregate","e":[{"type":"aggregate","function":"count","e":[]}]}]}}'
    );
  });

  test('No parent nor source explore', async () => {
    const parent_explore = new Explore(PARENT_EXPLORE);
    expect(Explore.fromJSON(parent_explore.toJSON())).toStrictEqual(
      parent_explore
    );
  });

  test('Having parent and source explores', async () => {
    const gradparent_explore = new Explore(GRADPARENT_EXPLORE);
    const parent_explore = new Explore(PARENT_EXPLORE, gradparent_explore);
    const source_explore = new Explore(SOURCE_EXPLORE);
    const child_explore = new Explore(
      CHILD_EXPLORE,
      parent_explore,
      source_explore
    );
    expect(Explore.fromJSON(child_explore.toJSON())).toStrictEqual(
      child_explore
    );
  });
});
