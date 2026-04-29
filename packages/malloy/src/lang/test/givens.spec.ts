/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  ConstantExpression,
  DefineGivens,
  Document,
  ExprAddSub,
  ExprNumber,
  GivenDeclaration,
  GivenReference,
} from '../ast';
import {TestTranslator, errorMessage, expr} from './test-translator';
import './parse-expects';

function parseDocument(src: string): Document {
  const t = new TestTranslator(src);
  const node = t.ast();
  if (!(node instanceof Document)) {
    throw new Error(
      `Expected top-level AST to be a Document, got ${node?.elementType ?? 'undefined'}\n${t.prettyErrors()}`
    );
  }
  return node;
}

function findDefineGivens(doc: Document): DefineGivens[] {
  const out: DefineGivens[] = [];
  for (const stmt of doc.statements.list) {
    if (stmt instanceof DefineGivens) out.push(stmt);
  }
  return out;
}

function onlyGivens(src: string): GivenDeclaration[] {
  const blocks = findDefineGivens(parseDocument(src));
  return blocks.flatMap(b => b.givens);
}

describe('given: declarations', () => {
  test('single declaration with no default', () => {
    const givens = onlyGivens('given: TENANT :: string');
    expect(givens).toHaveLength(1);
    expect(givens[0]).toBeInstanceOf(GivenDeclaration);
    expect(givens[0].name).toEqual('TENANT');
    expect(givens[0].typeDef).toEqual({type: 'string'});
    expect(givens[0].default).toBeUndefined();
  });

  test('declaration with default value', () => {
    const givens = onlyGivens('given: MAX_ROWS :: number is 1000');
    expect(givens).toHaveLength(1);
    expect(givens[0].name).toEqual('MAX_ROWS');
    expect(givens[0].typeDef).toEqual({type: 'number'});
    expect(givens[0].default).toBeInstanceOf(ConstantExpression);
  });

  test('multiple givens in one block', () => {
    const givens = onlyGivens(`
      given:
        TENANT :: string
        MAX_ROWS :: number is 1000
        CUTOFF :: date is @2024-01-01
    `);
    expect(givens.map(g => g.name)).toEqual(['TENANT', 'MAX_ROWS', 'CUTOFF']);
    expect(givens[0].default).toBeUndefined();
    expect(givens[1].default).toBeInstanceOf(ConstantExpression);
    expect(givens[2].default).toBeInstanceOf(ConstantExpression);
  });

  test('comma-separated givens in one block', () => {
    const givens = onlyGivens(`
      given:
        A :: string is "a",
        B :: number is 1,
        C :: boolean is true
    `);
    expect(givens.map(g => g.name)).toEqual(['A', 'B', 'C']);
  });

  test('all six basic types accepted', () => {
    const givens = onlyGivens(`
      given:
        S :: string
        N :: number
        B :: boolean
        D :: date
        T :: timestamp
        TZ :: timestamptz
    `);
    expect(givens.map(g => g.typeDef)).toEqual([
      {type: 'string'},
      {type: 'number'},
      {type: 'boolean'},
      {type: 'date'},
      {type: 'timestamp'},
      {type: 'timestamptz'},
    ]);
  });

  test('array type', () => {
    const givens = onlyGivens('given: ROLES :: string[]');
    expect(givens[0].typeDef).toMatchObject({
      type: 'array',
      elementTypeDef: {type: 'string'},
    });
  });

  test('record type', () => {
    const givens = onlyGivens(
      'given: SESSION :: { user :: string, tenant :: string }'
    );
    const t = givens[0].typeDef;
    expect(t).toMatchObject({type: 'record'});
    if ('fields' in t) {
      expect(t.fields.map(f => f.name)).toEqual(['user', 'tenant']);
    }
  });

  test('array of records', () => {
    const givens = onlyGivens(
      'given: ROWS :: { id :: number, name :: string }[]'
    );
    expect(givens[0].typeDef).toMatchObject({type: 'array'});
  });

  test('filter type', () => {
    const givens = onlyGivens('given: TENANT_FILTER :: filter<string>');
    expect(givens[0].typeDef).toEqual({
      type: 'filter expression',
      filterType: 'string',
    });
  });

  test('default value can be a constant expression over literals', () => {
    const givens = onlyGivens('given: CAP :: number is 10 + 5');
    expect(givens[0].default).toBeInstanceOf(ConstantExpression);
    const inner = givens[0].default?.children['expr'];
    expect(inner).toBeInstanceOf(ExprAddSub);
  });

  test('default can reference another given via $', () => {
    // The reference itself is just AST; the satisfiability check lands
    // with the IR work. Here we just verify the AST shape is right.
    const givens = onlyGivens(`
      given:
        BASE :: number is 100
        SCALED :: number is $BASE
    `);
    expect(givens[1].default).toBeInstanceOf(ConstantExpression);
    const inner = givens[1].default?.children['expr'];
    expect(inner).toBeInstanceOf(GivenReference);
    if (inner instanceof GivenReference) {
      expect(inner.name).toEqual('BASE');
    }
  });

  test('annotation on a given', () => {
    const givens = onlyGivens(`
      given:
        # label="Tenant"
        TENANT :: string
    `);
    expect(givens[0].note?.notes?.map(n => n.text)).toEqual([
      '# label="Tenant"\n',
    ]);
  });

  test('block-level annotation distributes to each item', () => {
    const givens = onlyGivens(`
      # block_tag
      given:
        A :: string
        B :: number
    `);
    // Block notes from the `given:` statement are pushed onto each child
    // declaration's note via extendNote, the same way DefineSourceList works.
    for (const g of givens) {
      const blockNotes = g.note?.blockNotes?.map(n => n.text) ?? [];
      expect(blockNotes).toContain('# block_tag\n');
    }
  });

  test('two given: blocks in same file', () => {
    const givens = onlyGivens(`
      given: A :: string
      given: B :: number
    `);
    expect(givens.map(g => g.name)).toEqual(['A', 'B']);
  });
});

describe('$NAME references in expressions', () => {
  test('parses as a GivenReference at top of the expression', () => {
    const e = expr`$TENANT`.translator.ast();
    expect(e).toBeInstanceOf(GivenReference);
    if (e instanceof GivenReference) {
      expect(e.name).toEqual('TENANT');
    }
  });

  test('participates in larger expressions', () => {
    const e = expr`$X + 1`.translator.ast();
    expect(e).toBeInstanceOf(ExprAddSub);
    const left = e?.children['left'];
    const right = e?.children['right'];
    expect(left).toBeInstanceOf(GivenReference);
    expect(right).toBeInstanceOf(ExprNumber);
    if (left instanceof GivenReference) {
      expect(left.name).toEqual('X');
    }
  });

  test('two references in one expression', () => {
    const e = expr`$A + $B`.translator.ast();
    expect(e).toBeInstanceOf(ExprAddSub);
    expect(e?.children['left']).toBeInstanceOf(GivenReference);
    expect(e?.children['right']).toBeInstanceOf(GivenReference);
  });

  test('underscores and digits in given name', () => {
    const e = expr`$MAX_ROWS_2`.translator.ast();
    expect(e).toBeInstanceOf(GivenReference);
    if (e instanceof GivenReference) {
      expect(e.name).toEqual('MAX_ROWS_2');
    }
  });

  test('lowercase given name parses (uppercase is convention, not enforced)', () => {
    const e = expr`$tenant`.translator.ast();
    expect(e).toBeInstanceOf(GivenReference);
    if (e instanceof GivenReference) {
      expect(e.name).toEqual('tenant');
    }
  });

  test('works on right side of comparison', () => {
    // String literal compared to $TENANT, parsed as a comparison expression.
    const e = expr`astr = $TENANT`.translator.ast();
    expect(e?.children['right']).toBeInstanceOf(GivenReference);
  });

  test('reference appears inside a default expression tree', () => {
    const givens = onlyGivens(`
      given:
        BASE :: number is 10
        SCALED :: number is $BASE + 5
    `);
    const def = givens[1].default;
    expect(def).toBeInstanceOf(ConstantExpression);
    const inner = def?.children['expr'];
    expect(inner).toBeInstanceOf(ExprAddSub);
    if (inner instanceof ExprAddSub) {
      expect(inner.children['left']).toBeInstanceOf(GivenReference);
      expect(inner.children['right']).toBeInstanceOf(ExprNumber);
    }
  });
});

describe('given: parse-time errors', () => {
  test('missing type is a parse error', () => {
    expect('given: TENANT').toLog(
      errorMessage(/extraneous|missing|mismatched/i)
    );
  });

  test('missing name is a parse error', () => {
    expect('given: :: string').toLog(
      errorMessage(/extraneous|missing|mismatched/i)
    );
  });

  test('annotation after `is` is rejected with a targeted error', () => {
    expect(`
      given:
        X :: number is
          # not_allowed
          100
    `).toLog(
      errorMessage(/Annotations are not allowed between .is. and the default/)
    );
  });

  test('json type rejected by grammar', () => {
    // `json` is intentionally not in `malloyBasicType`, so it cannot land
    // as a given type. The parser reports a syntax error rather than
    // accepting and later rejecting.
    expect('given: J :: json').toLog(
      errorMessage(/extraneous|missing|mismatched|no viable/i)
    );
  });
});

describe('given: translates without errors at the AST stage', () => {
  // The model should compile without error when a `given:` block is
  // present but no `$` references are used. (IR generation is a no-op.)
  test('declarations only', () => {
    expect(`
      given:
        TENANT :: string
        MAX_ROWS :: number is 1000
    `).toTranslate();
  });

  test('declarations alongside a normal source', () => {
    expect(`
      given:
        TENANT :: string
      source: x is a
    `).toTranslate();
  });

  test('using $NAME at the AST stage logs a not-implemented error', () => {
    // Until IR generation lands, any expression that consults $NAME's
    // value must produce an explicit error.
    expect(`
      given: T :: string
      source: x is a extend {
        where: astr = $T
      }
    `).toLog(errorMessage(/given references are not yet implemented/));
  });
});
