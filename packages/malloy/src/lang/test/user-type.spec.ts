/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {TestTranslator, error, errorMessage} from './test-translator';
import './parse-expects';

const experimental = '##! experimental.virtual_source\n';

function userTypeModel(src: string) {
  return new TestTranslator(experimental + src);
}

describe('user type shapes', () => {
  test('simple user type with basic type fields', () => {
    const m = userTypeModel(`
      type: MyStruct is {
        name :: string,
        age :: number,
        active :: boolean,
        birthday :: date
      }
    `);
    expect(m).toTranslate();
    const shape = m.getUserTypeDef('MyStruct');
    expect(shape).toBeDefined();
    expect(shape!.fields).toEqual([
      {name: 'name', typeDef: {type: 'string'}},
      {name: 'age', typeDef: {type: 'number'}},
      {name: 'active', typeDef: {type: 'boolean'}},
      {name: 'birthday', typeDef: {type: 'date'}},
    ]);
  });

  test('timestamp and timestamptz fields', () => {
    const m = userTypeModel(`
      type: Times is {
        created :: timestamp,
        modified :: timestamptz
      }
    `);
    expect(m).toTranslate();
    const shape = m.getUserTypeDef('Times');
    expect(shape!.fields).toEqual([
      {name: 'created', typeDef: {type: 'timestamp'}},
      {name: 'modified', typeDef: {type: 'timestamptz'}},
    ]);
  });

  test('multiple user types in one statement', () => {
    const m = userTypeModel(`
      type:
        A is { x :: string },
        B is { y :: number }
    `);
    expect(m).toTranslate();
    expect(m.getUserTypeDef('A')!.fields).toEqual([
      {name: 'x', typeDef: {type: 'string'}},
    ]);
    expect(m.getUserTypeDef('B')!.fields).toEqual([
      {name: 'y', typeDef: {type: 'number'}},
    ]);
  });

  test('user type extends another user type', () => {
    const m = userTypeModel(`
      type: Base is { name :: string, age :: number }
      type: Extended is Base extend { email :: string }
    `);
    expect(m).toTranslate();
    const shape = m.getUserTypeDef('Extended');
    expect(shape!.fields).toEqual([
      {name: 'name', typeDef: {type: 'string'}},
      {name: 'age', typeDef: {type: 'number'}},
      {name: 'email', typeDef: {type: 'string'}},
    ]);
  });

  test('user type extension overrides field from base', () => {
    const m = userTypeModel(`
      type: Base is { name :: string, value :: string }
      type: Override is Base extend { value :: number }
    `);
    expect(m).toTranslate();
    const shape = m.getUserTypeDef('Override');
    expect(shape!.fields).toEqual([
      {name: 'name', typeDef: {type: 'string'}},
      {name: 'value', typeDef: {type: 'number'}},
    ]);
  });

  test('array type field', () => {
    const m = userTypeModel(`
      type: WithArrays is {
        tags :: string[],
        scores :: number[]
      }
    `);
    expect(m).toTranslate();
    const shape = m.getUserTypeDef('WithArrays');
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
    const m = userTypeModel(`
      type: Matrix is {
        grid :: number[][]
      }
    `);
    expect(m).toTranslate();
    const shape = m.getUserTypeDef('Matrix');
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
    const m = userTypeModel(`
      type: WithSQL is {
        val :: 'integer'
      }
    `);
    expect(m).toTranslate();
    const shape = m.getUserTypeDef('WithSQL');
    expect(shape!.fields).toEqual([
      {name: 'val', typeDef: {type: 'sql native', rawType: 'integer'}},
    ]);
  });

  test('inline record type field', () => {
    const m = userTypeModel(`
      type: WithRecord is {
        address :: {
          street :: string,
          city :: string
        }
      }
    `);
    expect(m).toTranslate();
    const shape = m.getUserTypeDef('WithRecord');
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

  test('field referencing another user type becomes record', () => {
    const m = userTypeModel(`
      type: Address is { street :: string, city :: string }
      type: Person is {
        name :: string,
        home :: Address
      }
    `);
    expect(m).toTranslate();
    const shape = m.getUserTypeDef('Person');
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
    const m = userTypeModel(`
      type: WithNestedRecords is {
        matrix :: { x :: number, y :: number }[][]
      }
    `);
    expect(m).toTranslate();
    const shape = m.getUserTypeDef('WithNestedRecords');
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

  test('user type used as type in another user type', () => {
    const m = userTypeModel(`
      type: Leaf is { value :: number }
      type: Branch is { data :: Leaf }
      type: Root is { item :: Branch }
    `);
    expect(m).toTranslate();
    const branch = m.getUserTypeDef('Branch');
    expect(branch!.fields).toEqual([
      {
        name: 'data',
        typeDef: {
          type: 'record',
          fields: [{name: 'value', type: 'number'}],
        },
      },
    ]);
    const root = m.getUserTypeDef('Root');
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

describe('user type shape errors', () => {
  test('duplicate user type name', () => {
    expect(
      userTypeModel(`
      type: Dupe is { x :: string }
      type: Dupe is { y :: number }
    `)
    ).toLog(error('user-type-definition-name-conflict'));
  });

  test('extend undefined user type', () => {
    expect(
      userTypeModel(`
      type: Bad is NoSuch extend { x :: string }
    `)
    ).toLog(error('user-type-not-found'));
  });

  test('extend non-user-type name', () => {
    expect(
      userTypeModel(`
      source: s is _db_.table('aTable')
      type: Bad is s extend { x :: string }
    `)
    ).toLog(error('not-a-user-type'));
  });

  test('field references undefined user type', () => {
    expect(
      userTypeModel(`
      type: Bad is { data :: NoSuch }
    `)
    ).toLog(error('user-type-not-found'));
  });

  test('field references non-user-type name', () => {
    expect(
      userTypeModel(`
      source: s is _db_.table('aTable')
      type: Bad is { data :: s }
    `)
    ).toLog(error('not-a-user-type'));
  });

  test('array of named user type reference', () => {
    const m = userTypeModel(`
      type: Base is { x :: string }
      type: WithArray is { items :: Base[] }
    `);
    expect(m).toTranslate();
    const shape = m.getUserTypeDef('WithArray');
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

  test('named user type reference as inline record field type', () => {
    expect(
      userTypeModel(`
      type: Base is { x :: string }
      type: Bad is {
        rec :: { nested :: Base }
      }
    `)
    ).toLog(
      errorMessage(
        /Named user type reference.*cannot be used as an inline record field type/
      )
    );
  });
});

describe('experimental gate', () => {
  test('user type without experimental flag', () => {
    expect(`
      type: S is { x :: string }
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
