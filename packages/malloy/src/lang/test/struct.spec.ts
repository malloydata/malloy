/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {TestTranslator, error, errorMessage} from './test-translator';
import './parse-expects';

const experimental = '##! experimental.virtual_source\n';

function structModel(src: string) {
  return new TestTranslator(experimental + src);
}

describe('struct shapes', () => {
  test('simple struct with basic type fields', () => {
    const m = structModel(`
      struct: MyStruct is {
        name :: string,
        age :: number,
        active :: boolean,
        birthday :: date
      }
    `);
    expect(m).toTranslate();
    const shape = m.getStructShapeDef('MyStruct');
    expect(shape).toBeDefined();
    expect(shape!.fields).toEqual([
      {name: 'name', typeDef: {type: 'string'}},
      {name: 'age', typeDef: {type: 'number'}},
      {name: 'active', typeDef: {type: 'boolean'}},
      {name: 'birthday', typeDef: {type: 'date'}},
    ]);
  });

  test('timestamp and timestamptz fields', () => {
    const m = structModel(`
      struct: Times is {
        created :: timestamp,
        modified :: timestamptz
      }
    `);
    expect(m).toTranslate();
    const shape = m.getStructShapeDef('Times');
    expect(shape!.fields).toEqual([
      {name: 'created', typeDef: {type: 'timestamp'}},
      {name: 'modified', typeDef: {type: 'timestamptz'}},
    ]);
  });

  test('multiple structs in one statement', () => {
    const m = structModel(`
      struct:
        A is { x :: string },
        B is { y :: number }
    `);
    expect(m).toTranslate();
    expect(m.getStructShapeDef('A')!.fields).toEqual([
      {name: 'x', typeDef: {type: 'string'}},
    ]);
    expect(m.getStructShapeDef('B')!.fields).toEqual([
      {name: 'y', typeDef: {type: 'number'}},
    ]);
  });

  test('struct extends another struct', () => {
    const m = structModel(`
      struct: Base is { name :: string, age :: number }
      struct: Extended is Base extend { email :: string }
    `);
    expect(m).toTranslate();
    const shape = m.getStructShapeDef('Extended');
    expect(shape!.fields).toEqual([
      {name: 'name', typeDef: {type: 'string'}},
      {name: 'age', typeDef: {type: 'number'}},
      {name: 'email', typeDef: {type: 'string'}},
    ]);
  });

  test('struct extension overrides field from base', () => {
    const m = structModel(`
      struct: Base is { name :: string, value :: string }
      struct: Override is Base extend { value :: number }
    `);
    expect(m).toTranslate();
    const shape = m.getStructShapeDef('Override');
    expect(shape!.fields).toEqual([
      {name: 'name', typeDef: {type: 'string'}},
      {name: 'value', typeDef: {type: 'number'}},
    ]);
  });

  test('array type field', () => {
    const m = structModel(`
      struct: WithArrays is {
        tags :: string[],
        scores :: number[]
      }
    `);
    expect(m).toTranslate();
    const shape = m.getStructShapeDef('WithArrays');
    expect(shape!.fields).toEqual([
      {
        name: 'tags',
        typeDef: {type: 'array', elementTypeDef: {type: 'string'}},
      },
      {
        name: 'scores',
        typeDef: {type: 'array', elementTypeDef: {type: 'number'}},
      },
    ]);
  });

  test('nested array type field', () => {
    const m = structModel(`
      struct: Matrix is {
        grid :: number[][]
      }
    `);
    expect(m).toTranslate();
    const shape = m.getStructShapeDef('Matrix');
    expect(shape!.fields).toEqual([
      {
        name: 'grid',
        typeDef: {
          type: 'array',
          elementTypeDef: {type: 'array', elementTypeDef: {type: 'number'}},
        },
      },
    ]);
  });

  test('sql native type field', () => {
    const m = structModel(`
      struct: WithSQL is {
        val :: 'integer'
      }
    `);
    expect(m).toTranslate();
    const shape = m.getStructShapeDef('WithSQL');
    expect(shape!.fields).toEqual([
      {name: 'val', typeDef: {type: 'sql native', rawType: 'integer'}},
    ]);
  });

  test('inline record type field', () => {
    const m = structModel(`
      struct: WithRecord is {
        address :: {
          street :: string,
          city :: string
        }
      }
    `);
    expect(m).toTranslate();
    const shape = m.getStructShapeDef('WithRecord');
    expect(shape!.fields).toEqual([
      {
        name: 'address',
        typeDef: {
          type: 'record',
          fields: [
            {name: 'street', type: 'string'},
            {name: 'city', type: 'string'},
          ],
        },
      },
    ]);
  });

  test('field referencing another struct becomes record', () => {
    const m = structModel(`
      struct: Address is { street :: string, city :: string }
      struct: Person is {
        name :: string,
        home :: Address
      }
    `);
    expect(m).toTranslate();
    const shape = m.getStructShapeDef('Person');
    expect(shape!.fields).toEqual([
      {name: 'name', typeDef: {type: 'string'}},
      {
        name: 'home',
        typeDef: {
          type: 'record',
          fields: [
            {name: 'street', type: 'string'},
            {name: 'city', type: 'string'},
          ],
        },
      },
    ]);
  });

  test('nested array of records', () => {
    const m = structModel(`
      struct: WithNestedRecords is {
        matrix :: { x :: number, y :: number }[][]
      }
    `);
    expect(m).toTranslate();
    const shape = m.getStructShapeDef('WithNestedRecords');
    expect(shape!.fields).toEqual([
      {
        name: 'matrix',
        typeDef: {
          type: 'array',
          elementTypeDef: {
            type: 'array',
            elementTypeDef: {type: 'record_element'},
            fields: [
              {name: 'x', type: 'number'},
              {name: 'y', type: 'number'},
            ],
          },
        },
      },
    ]);
  });

  test('struct used as type in another struct', () => {
    const m = structModel(`
      struct: Leaf is { value :: number }
      struct: Branch is { data :: Leaf }
      struct: Root is { item :: Branch }
    `);
    expect(m).toTranslate();
    const branch = m.getStructShapeDef('Branch');
    expect(branch!.fields).toEqual([
      {
        name: 'data',
        typeDef: {
          type: 'record',
          fields: [{name: 'value', type: 'number'}],
        },
      },
    ]);
    const root = m.getStructShapeDef('Root');
    expect(root!.fields).toEqual([
      {
        name: 'item',
        typeDef: {
          type: 'record',
          fields: [
            {
              name: 'data',
              type: 'record',
              join: 'one',
              fields: [{name: 'value', type: 'number'}],
            },
          ],
        },
      },
    ]);
  });
});

describe('struct shape errors', () => {
  test('duplicate struct name', () => {
    expect(
      structModel(`
      struct: Dupe is { x :: string }
      struct: Dupe is { y :: number }
    `)
    ).toLog(error('struct-definition-name-conflict'));
  });

  test('extend undefined struct', () => {
    expect(
      structModel(`
      struct: Bad is NoSuch extend { x :: string }
    `)
    ).toLog(error('struct-not-found'));
  });

  test('extend non-struct name', () => {
    expect(
      structModel(`
      source: s is _db_.table('aTable')
      struct: Bad is s extend { x :: string }
    `)
    ).toLog(error('not-a-struct'));
  });

  test('field references undefined struct', () => {
    expect(
      structModel(`
      struct: Bad is { data :: NoSuch }
    `)
    ).toLog(error('struct-not-found'));
  });

  test('field references non-struct name', () => {
    expect(
      structModel(`
      source: s is _db_.table('aTable')
      struct: Bad is { data :: s }
    `)
    ).toLog(error('not-a-struct'));
  });

  test('array of named struct reference', () => {
    const m = structModel(`
      struct: Base is { x :: string }
      struct: WithArray is { items :: Base[] }
    `);
    expect(m).toTranslate();
    const shape = m.getStructShapeDef('WithArray');
    expect(shape!.fields).toEqual([
      {
        name: 'items',
        typeDef: {
          type: 'array',
          elementTypeDef: {type: 'record_element'},
          fields: [{name: 'x', type: 'string'}],
        },
      },
    ]);
  });

  test('named struct reference as inline record field type', () => {
    expect(
      structModel(`
      struct: Base is { x :: string }
      struct: Bad is {
        rec :: { nested :: Base }
      }
    `)
    ).toLog(
      errorMessage(
        /Named struct reference.*cannot be used as an inline record field type/
      )
    );
  });
});

describe('experimental gate', () => {
  test('struct without experimental flag', () => {
    expect(`
      struct: S is { x :: string }
    `).toLog(error('experiment-not-enabled', {experimentId: 'virtual_source'}));
  });

  test('virtual without experimental flag', () => {
    expect(`
      source: v is _db_.virtual('t')
    `).toLog(error('experiment-not-enabled', {experimentId: 'virtual_source'}));
  });

  test(':: type operator without experimental flag', () => {
    expect(`
      source: typed is a::SomeStruct
    `).toLog(error('experiment-not-enabled', {experimentId: 'virtual_source'}));
  });
});
