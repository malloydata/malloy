/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Tag, TagDict} from '../tags';
import {parseTagLineWithPeggy} from './index';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      peggyTagsAre(t: TagDict): R;
    }
  }
}

expect.extend({
  peggyTagsAre(src: string | Tag, result: Tag) {
    if (typeof src === 'string') {
      const {tag, log} = parseTagLineWithPeggy(src);
      const errs = log.map(e => e.message);
      if (log.length > 0) {
        return {
          pass: false,
          message: () => `${src}: Peggy Parsing Error(s)\n${errs.join('\n')}`,
        };
      }
      src = tag;
    }
    const got = src.properties;
    if (this.equals(got, result)) {
      return {
        pass: true,
        message: () => 'Parse returned expected object',
      };
    }
    return {
      pass: false,
      message: () => this.utils.diff(result, got) ?? 'Not different',
    };
  },
});

type TagTestTuple = [string, TagDict];

describe('Peggy parser', () => {
  const tagTests: TagTestTuple[] = [
    ['just_name', {just_name: {}}],
    ['name=bare_string', {name: {eq: 'bare_string'}}],
    ['name="quoted_string"', {name: {eq: 'quoted_string'}}],
    ['name {prop1}', {name: {properties: {prop1: {}}}}],
    [
      'name {prop1 prop2=value}',
      {
        name: {
          properties: {
            prop1: {},
            prop2: {eq: 'value'},
          },
        },
      },
    ],
    ['name.prop', {name: {properties: {prop: {}}}}],
    ['name.prop=value', {name: {properties: {prop: {eq: 'value'}}}}],
    [
      'name.prop.sub=value',
      {name: {properties: {prop: {properties: {sub: {eq: 'value'}}}}}},
    ],
    [
      'name{first3=[a, b, c]}',
      {name: {properties: {first3: {eq: [{eq: 'a'}, {eq: 'b'}, {eq: 'c'}]}}}},
    ],
    ['name{first1=[a,]}', {name: {properties: {first1: {eq: [{eq: 'a'}]}}}}],
    [
      'name{first=[a {A}]}',
      {name: {properties: {first: {eq: [{eq: 'a', properties: {A: {}}}]}}}},
    ],
    [
      'name{first=[{A}]}',
      {name: {properties: {first: {eq: [{properties: {A: {}}}]}}}},
    ],
    ['name=value {prop}', {name: {eq: 'value', properties: {prop: {}}}}],
    [
      'name.prop={prop2}',
      {name: {properties: {prop: {properties: {prop2: {}}}}}},
    ],
    ['no yes -no', {yes: {}, no: {deleted: true}}],
    ['x -x.y', {x: {properties: {y: {deleted: true}}}}],
    ['x={y} -x.y', {x: {properties: {y: {deleted: true}}}}],
    ['x={y z} -x.y', {x: {properties: {z: {}, y: {deleted: true}}}}],
    ['x={y z} x {-y}', {x: {properties: {z: {}, y: {deleted: true}}}}],
    ['x=1 x {xx=11}', {x: {eq: '1', properties: {xx: {eq: '11'}}}}],
    ['x.y=xx x=1 {...}', {x: {eq: '1', properties: {y: {eq: 'xx'}}}}],
    ['a {b c} a=1', {a: {eq: '1'}}],
    ['a=1 a=...{b}', {a: {eq: '1', properties: {b: {}}}}],
    [
      'a=red { shade=dark } color=$(a) shade=$(a.shade)',
      {
        a: {eq: 'red', properties: {shade: {eq: 'dark'}}},
        color: {eq: 'red', properties: {shade: {eq: 'dark'}}},
        shade: {eq: 'dark'},
      },
    ],
    ['x=.01', {x: {eq: '.01'}}],
    ['x=-7', {x: {eq: '-7'}}],
    ['x=7', {x: {eq: '7'}}],
    ['x=7.0', {x: {eq: '7.0'}}],
    ['x=.7', {x: {eq: '.7'}}],
    ['x=.7e2', {x: {eq: '.7e2'}}],
    ['x=7E2', {x: {eq: '7E2'}}],
    ['`spacey name`=Zaphod', {'spacey name': {eq: 'Zaphod'}}],
    [
      'image { alt=hello { field=department } }',
      {
        image: {
          properties: {
            alt: {eq: 'hello', properties: {field: {eq: 'department'}}},
          },
        },
      },
    ],
    [
      'image image.alt=hello image.alt.field=department',
      {
        image: {
          properties: {
            alt: {eq: 'hello', properties: {field: {eq: 'department'}}},
          },
        },
      },
    ],
    ['can remove.properties -...', {}],
  ];

  test.each(tagTests)('tag %s', (expression: string, expected: TagDict) => {
    expect(expression).peggyTagsAre(expected);
  });

  test('multi-line input', () => {
    const multiLine = `
      name=value
      other=stuff
    `;
    const {tag, log} = parseTagLineWithPeggy(multiLine);
    expect(log).toEqual([]);
    expect(tag.text('name')).toEqual('value');
    expect(tag.text('other')).toEqual('stuff');
  });

  test('comments are ignored', () => {
    const withComments = `
      # this is a comment
      name=value
      # another comment
      other=stuff
    `;
    const {tag, log} = parseTagLineWithPeggy(withComments);
    expect(log).toEqual([]);
    expect(tag.text('name')).toEqual('value');
    expect(tag.text('other')).toEqual('stuff');
  });

  test('skips # prefix like ANTLR parser', () => {
    const {tag, log} = parseTagLineWithPeggy('# name=value');
    expect(log).toEqual([]);
    expect(tag.text('name')).toEqual('value');
  });

  test('skips #(docs) prefix', () => {
    const {tag, log} = parseTagLineWithPeggy('#(docs) name=value');
    expect(log).toEqual([]);
    expect(tag.text('name')).toEqual('value');
  });
});
