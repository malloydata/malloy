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

describe('given: experimental flag', () => {
  test('declarations require the experimental flag', () => {
    expect(`
      given:
        TENANT :: string
    `).toLog(errorMessage(/Experimental flag .givens. is not set/));
  });

  test('$NAME references require the experimental flag', () => {
    // The given declaration is gated; the reference site is gated too,
    // so a file that uses $NAME without declaring givens still errors.
    expect(`
      run: a -> { where: astr = $T; select: * }
    `).toLog(errorMessage(/Experimental flag .givens. is not set/));
  });
});

describe('given: IR generation', () => {
  test('declarations populate ModelDef.givens and contents', () => {
    const t = new TestTranslator(`
      ##! experimental.givens
      given:
        TENANT :: string
        MAX_ROWS :: number is 1000
    `);
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    expect(md.givens).toBeDefined();
    expect(Object.keys(md.givens!)).toHaveLength(2);
    // ModelDef.contents has surface-name pointers
    expect(md.contents['TENANT']?.type).toBe('given');
    expect(md.contents['MAX_ROWS']?.type).toBe('given');
  });

  test('GivenEntry id matches a Given declaration', () => {
    const t = new TestTranslator(`
      ##! experimental.givens
      given: TENANT :: string
    `);
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    const entry = md.contents['TENANT'];
    expect(entry?.type).toBe('given');
    if (entry?.type === 'given') {
      expect(md.givens?.[entry.id]).toBeDefined();
      expect(md.givens?.[entry.id].type).toEqual({type: 'string'});
    }
  });

  test('default value lands on Given.default as IR expression', () => {
    const t = new TestTranslator(`
      ##! experimental.givens
      given: MAX_VAL :: number is 100
    `);
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    const id = (md.contents['MAX_VAL'] as {id: string}).id;
    const given = md.givens![id];
    expect(given.default).toBeDefined();
    expect(given.default).toMatchObject({node: 'numberLiteral'});
  });

  test('absent default is `undefined` (explicit, not missing key)', () => {
    const t = new TestTranslator(`
      ##! experimental.givens
      given: TENANT :: string
    `);
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    const id = (md.contents['TENANT'] as {id: string}).id;
    expect(md.givens![id]).toHaveProperty('default');
    expect(md.givens![id].default).toBeUndefined();
  });

  test('$NAME inside a where clause produces a GivenRefNode in IR', () => {
    const t = new TestTranslator(`
      ##! experimental.givens
      given: TENANT :: string
      run: a -> { where: astr = $TENANT; select: * }
    `);
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    const id = (md.contents['TENANT'] as {id: string}).id;
    let found: {id: string; refName: string} | undefined;
    function walk(n: unknown) {
      if (n && typeof n === 'object') {
        const node = n as {node?: string; id?: string; refName?: string};
        if (node.node === 'given') {
          found = {id: node.id!, refName: node.refName!};
        }
        for (const v of Object.values(n)) walk(v);
      }
    }
    walk(md.queryList);
    expect(found).toEqual({id, refName: 'TENANT'});
  });

  test('unknown $NAME errors at compile time', () => {
    expect(`
      ##! experimental.givens
      run: a -> { where: astr = $UNKNOWN; select: * }
    `).toLog(errorMessage(/`\$UNKNOWN` is not a declared given/));
  });

  test('non-given namespace entry rejected with the same name', () => {
    // `a` is a pre-declared source in the test fixture; `$a` resolves to
    // the source entry, not a given, so it errors.
    expect(`
      ##! experimental.givens
      run: a -> { where: astr = $a; select: * }
    `).toLog(errorMessage(/`\$a` is not a given/));
  });

  test('default may reference another given', () => {
    expect(`
      ##! experimental.givens
      given:
        BASE :: number is 10
        SCALED :: number is $BASE
    `).toTranslate();
  });

  test('default may not reference a field (constant-only enforcement)', () => {
    expect(`
      ##! experimental.givens
      source: x is a extend {
        dimension: y is 5
      }
      given: BAD :: number is x.y
    `).toLog(errorMessage(/Only constants allowed/));
  });

  test('default value type-checked against declared type', () => {
    expect(`
      ##! experimental.givens
      given: BAD :: number is "not a number"
    `).toLog(
      errorMessage(
        'Default value of type `string` does not match declared type `number`'
      )
    );
  });

  test('compound declared type echoes back in type-mismatch error', () => {
    expect(`
      ##! experimental.givens
      given: BAD :: string[] is 1
    `).toLog(
      errorMessage(
        'Default value of type `number` does not match declared type `string[]`'
      )
    );
  });

  test('array element-type mismatch is caught (deep equality via TD.eq)', () => {
    expect(`
      ##! experimental.givens
      given: BAD :: string[] is [1, 2, 3]
    `).toLog(
      errorMessage(
        /Default value of type `number\[\]` does not match declared type `string\[\]`/
      )
    );
  });

  test('filter<T> declared with non-filter default is caught', () => {
    expect(`
      ##! experimental.givens
      given: BAD :: filter<string> is "not-a-filter"
    `).toLog(
      errorMessage(
        /Default value of type `string` does not match declared type `filter<string>`/
      )
    );
  });

  test('filter<T> default with valid filter literal translates', () => {
    expect(`
      ##! experimental.givens
      given: TENANT_FILTER :: filter<string> is f'acme | beta'
    `).toTranslate();
  });

  test('filter<T> default with bad filter syntax errors at declaration', () => {
    // We know T at the declaration site, so the filter literal is
    // validated against T here, not just at use sites.
    expect(`
      ##! experimental.givens
      given: BAD :: filter<number> is f'not a number'
    `).toLog(errorMessage(/Filter syntax error/));
  });

  test('redeclaring a given name errors', () => {
    expect(`
      ##! experimental.givens
      given:
        TENANT :: string
        TENANT :: number
    `).toLog(errorMessage(/Cannot redefine 'TENANT'/));
  });

  test('given name colliding with a source errors', () => {
    expect(`
      ##! experimental.givens
      source: TENANT is a
      given: TENANT :: string
    `).toLog(errorMessage(/Cannot redefine 'TENANT'/));
  });
});
