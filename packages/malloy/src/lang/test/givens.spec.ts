/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {
  ConstantExpression,
  DefineGivens,
  Document,
  ExprAddSub,
  ExprInGiven,
  ExprNumber,
  GivenDeclaration,
  GivenReference,
} from '../ast';
import {
  BetaExpression,
  TestTranslator,
  errorMessage,
  markSource,
} from './test-translator';
import './parse-expects';
import type {ModelDef, Query} from '../..';
import {Model, type Given} from '../../api/foundation/core';

// BetaExpression compiles a single expression; the source has no room
// for `##!` annotations. Seed the translator's compilerFlagSrc directly
// so the AST-build-time `inExperiment('givens', ...)` check passes.
function givenExpr(unmarked: TemplateStringsArray, ...marked: string[]) {
  const ms = markSource(unmarked, ...marked);
  const translator = new BetaExpression(ms.code);
  translator.compilerFlagSrc = ['##! experimental.givens\n'];
  return {...ms, translator};
}

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
  // Most AST-shape tests don't bother spelling the flag every time;
  // the flag check fires at AST-build time, so we prepend it here.
  const blocks = findDefineGivens(
    parseDocument(`##! experimental.givens\n${src}`)
  );
  return blocks.flatMap(b => b.givens);
}

// Lookup a given's id by surface name in a translated modelDef. Throws
// (rather than coalescing to undefined) so test failures point at the
// real cause when the given is missing.
function givenId(md: ModelDef, name: string): string {
  const entry = md.contents[name];
  if (!entry || entry.type !== 'given') {
    throw new Error(`Expected '${name}' to be a given in modelDef.contents`);
  }
  return entry.id;
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
    const e = givenExpr`$TENANT`.translator.ast();
    expect(e).toBeInstanceOf(GivenReference);
    if (e instanceof GivenReference) {
      expect(e.name).toEqual('TENANT');
    }
  });

  test('participates in larger expressions', () => {
    const e = givenExpr`$X + 1`.translator.ast();
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
    const e = givenExpr`$A + $B`.translator.ast();
    expect(e).toBeInstanceOf(ExprAddSub);
    expect(e?.children['left']).toBeInstanceOf(GivenReference);
    expect(e?.children['right']).toBeInstanceOf(GivenReference);
  });

  test('underscores and digits in given name', () => {
    const e = givenExpr`$MAX_ROWS_2`.translator.ast();
    expect(e).toBeInstanceOf(GivenReference);
    if (e instanceof GivenReference) {
      expect(e.name).toEqual('MAX_ROWS_2');
    }
  });

  test('lowercase given name parses (uppercase is convention, not enforced)', () => {
    const e = givenExpr`$tenant`.translator.ast();
    expect(e).toBeInstanceOf(GivenReference);
    if (e instanceof GivenReference) {
      expect(e.name).toEqual('tenant');
    }
  });

  test('works on right side of comparison', () => {
    // String literal compared to $TENANT, parsed as a comparison expression.
    const e = givenExpr`astr = $TENANT`.translator.ast();
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
      errorMessage(/extraneous|missing|mismatched|no viable/i)
    );
  });

  test('missing name is a parse error', () => {
    expect('given: :: string').toLog(
      errorMessage(/extraneous|missing|mismatched/i)
    );
  });

  test('annotation after `is` is rejected with a targeted error', () => {
    expect(`
      ##! experimental.givens
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
    const id = givenId(md, 'MAX_VAL');
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
    const id = givenId(md, 'TENANT');
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
    const id = givenId(md, 'TENANT');
    let found: {id: string; refName: string} | undefined;
    function walk(n: unknown): void {
      if (n === null || typeof n !== 'object') return;
      if ('node' in n && n.node === 'given' && 'id' in n && 'refName' in n) {
        found = {id: String(n.id), refName: String(n.refName)};
      }
      for (const v of Object.values(n)) walk(v);
    }
    walk(md.queryList);
    expect(found).toEqual({id, refName: 'TENANT'});
  });

  test('unknown $NAME errors at compile time', () => {
    expect(`
      ##! experimental.givens
      run: a -> { where: astr = $UNKNOWN; select: * }
    `).toLog(
      errorMessage(
        /`\$UNKNOWN` references a given named `UNKNOWN`, which is not declared/
      )
    );
  });

  test('non-given namespace entry rejected with the same name', () => {
    // `a` is a pre-declared source in the test fixture; `$a` resolves to
    // the source entry, not a given, so it errors.
    expect(`
      ##! experimental.givens
      run: a -> { where: astr = $a; select: * }
    `).toLog(errorMessage(/`\$a` expects a given named `a`, but `a` is a/));
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

  test('date literal accepted for declared timestamp (morphic)', () => {
    expect(`
      ##! experimental.givens
      given: X :: timestamp is @2001-02-02
    `).toTranslate();
  });

  test('timestamp literal not accepted for declared date (no reverse morph)', () => {
    expect(`
      ##! experimental.givens
      given: BAD :: date is @2001-02-02 12:00:00
    `).toLog(
      errorMessage(
        'Default value of type `timestamp` does not match declared type `date`'
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

describe('given: imports', () => {
  // Helper: child file `child` is the imported module, parent `code` is
  // the importer. Returns the parent translator after compile.
  function importTest(parent: string, child: string): TestTranslator {
    const t = new TestTranslator(parent);
    t.unresolved();
    t.update({urls: {'internal://test/langtests/child': child}});
    t.compile();
    return t;
  }

  test('selective import surfaces a given by name', () => {
    const t = importTest(
      `
        ##! experimental.givens
        import { MAX_ROWS } from "child"
      `,
      `
        ##! experimental.givens
        given: MAX_ROWS :: number is 100
      `
    );
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    expect(md.contents['MAX_ROWS']?.type).toBe('given');
  });

  test('selective import with rename: id stays the source-side id', () => {
    const t = importTest(
      `
        ##! experimental.givens
        import { CAP is MAX_ROWS } from "child"
      `,
      `
        ##! experimental.givens
        given: MAX_ROWS :: number is 100
      `
    );
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    expect(md.contents['CAP']?.type).toBe('given');
    expect(md.contents['MAX_ROWS']).toBeUndefined();
    const cap = md.contents['CAP'];
    expect(cap?.type).toBe('given');
    // Whatever id child assigned to MAX_ROWS, A's CAP must carry it.
    // Looking up by name in child's modelDef avoids any dependence on
    // the GivenID format (today readable, possibly a UUID later).
    const childT = t.childTranslators.get('internal://test/langtests/child');
    const childMaxRows = childT?.modelDef.contents['MAX_ROWS'];
    expect(childMaxRows?.type).toBe('given');
    if (cap?.type === 'given' && childMaxRows?.type === 'given') {
      expect(cap.id).toEqual(childMaxRows.id);
      expect(md.givens?.[cap.id]).toBeDefined();
      expect(md.givens?.[cap.id].type).toEqual({type: 'number'});
    }
  });

  test('non-selective import auto-surfaces givens under their original name', () => {
    // `import "child"` brings child's sources, queries, AND givens — each
    // surfacing under the name child declared.
    const t = importTest(
      `
        ##! experimental.givens
        import "child"
        run: a -> { where: astr = $TENANT; select: * }
      `,
      `
        ##! experimental.givens
        given: TENANT :: string is "acme"
      `
    );
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    expect(md.contents['TENANT']?.type).toBe('given');
  });

  test('non-selective import copies givens into the local map and the namespace', () => {
    const t = importTest(
      `
        ##! experimental.givens
        import "child"
      `,
      `
        ##! experimental.givens
        given:
          TENANT :: string is "acme"
          MAX_ROWS :: number is 1000
      `
    );
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    // Both givens land in the importer's namespace under their original names.
    expect(md.contents['TENANT']?.type).toBe('given');
    expect(md.contents['MAX_ROWS']?.type).toBe('given');
    // And every given declared in child appears in the importer's
    // givens map under the same id child assigned.
    const childT = t.childTranslators.get('internal://test/langtests/child');
    const childGivens = childT?.modelDef.givens ?? {};
    expect(Object.keys(childGivens).length).toBeGreaterThan(0);
    for (const id of Object.keys(childGivens)) {
      expect(md.givens?.[id]).toBeDefined();
      expect(md.givens?.[id]).toEqual(childGivens[id]);
    }
  });

  test('non-selective import collision with local declaration errors', () => {
    expect(
      importTest(
        `
          ##! experimental.givens
          given: TENANT :: string is "local"
          import "child"
        `,
        `
          ##! experimental.givens
          given: TENANT :: string is "child"
        `
      )
    ).toLog(errorMessage(/Cannot redefine 'TENANT'/));
  });

  test('imported source can reference its own given via $ at use site', () => {
    // childSrc references $TENANT from child. When parent uses childSrc,
    // SQL emission needs to resolve $TENANT to child's given declaration —
    // which works because we copy child.givens into parent.documentGivens.
    expect(
      importTest(
        `
        ##! experimental.givens
        import { childSrc } from "child"
        run: childSrc -> { select: * }
      `,
        `
        ##! experimental.givens
        given: TENANT :: string is "acme"
        source: childSrc is a extend {
          where: astr = $TENANT
        }
      `
      )
    ).toTranslate();
  });

  test('non-existent imported given errors with did-you-mean style message', () => {
    expect(
      importTest(
        `
        ##! experimental.givens
        import { NOT_A_GIVEN } from "child"
      `,
        `
        ##! experimental.givens
        given: TENANT :: string
      `
      )
    ).toLog(errorMessage(/Cannot find 'NOT_A_GIVEN'/));
  });

  test('importing the same given under two names is rejected as an alias collision', () => {
    // The supply-side contract is one surface name per given; aliasing
    // is ambiguous. Workaround: declare a local given with a default-chain
    // reference (`given: CAP :: number is $MAX_ROWS`).
    const t = importTest(
      `
        ##! experimental.givens
        import { MAX_ROWS } from "child"
        import { CAP is MAX_ROWS } from "child"
      `,
      `
        ##! experimental.givens
        given: MAX_ROWS :: number is 100
      `
    );
    expect(t).toLog(errorMessage(/surfaced under multiple names/));
  });

  test("chained imports: C's given flows through B into A", () => {
    // A imports B. B imports C and uses C's $TENANT in a source. A uses
    // B's source. SQL emission in A needs C's given declaration —
    // verifies the documentGivens copy is chainable: B's modelDef.givens
    // already contains C's givens (because B copied them at B's import
    // time), so A reading B's givens map transitively pulls C's in.
    const t = new TestTranslator(`
      ##! experimental.givens
      import { bSrc } from "b"
      run: bSrc -> { select: * }
    `);
    t.unresolved();
    t.update({
      urls: {
        'internal://test/langtests/b': `
          ##! experimental.givens
          import { TENANT } from "c"
          source: bSrc is a extend { where: astr = $TENANT }
        `,
        'internal://test/langtests/c': `
          ##! experimental.givens
          given: TENANT :: string is "acme"
        `,
      },
    });
    t.compile();
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    // A.modelDef.givens should contain TENANT (C's declaration) even
    // though A only directly imports from B.
    expect(md.givens).toBeDefined();
    expect(Object.keys(md.givens!).length).toBeGreaterThanOrEqual(1);
    // The given's id should encode C's URL, not B's or A's.
    const ids = Object.keys(md.givens!);
    expect(ids.some(id => id.includes('TENANT') && id.includes('/c'))).toBe(
      true
    );
  });

  test('selective import name collision with local given errors', () => {
    expect(
      importTest(
        `
        ##! experimental.givens
        given: MAX_ROWS :: number is 50
        import { MAX_ROWS } from "child"
      `,
        `
        ##! experimental.givens
        given: MAX_ROWS :: number is 100
      `
      )
    ).toLog(errorMessage(/Cannot redefine 'MAX_ROWS'/));
  });
});

describe('given: per-Query givenUsage summary', () => {
  // Given a translated model and a list of surface names, return the set of
  // GivenIDs those names resolve to via ModelDef.contents.
  function givenIds(md: ModelDef, ...names: string[]): Set<string> {
    return new Set(
      names.map(n => {
        const e = md.contents[n];
        if (!e || e.type !== 'given') {
          throw new Error(`No given named '${n}' in model contents`);
        }
        return e.id;
      })
    );
  }
  function queryGivenIds(q: Query | undefined): Set<string> {
    return new Set((q?.givenUsage ?? []).map(g => g.id));
  }
  function translateOK(src: string): ModelDef {
    const t = new TestTranslator(src);
    expect(t).toTranslate();
    return t.translate().modelDef!;
  }

  describe('union across segments', () => {
    test('givens in two pipeline segments unioned into Query.givenUsage', () => {
      const md = translateOK(`
        ##! experimental.givens
        given:
          A :: number is 1
          B :: number is 2
        run: a -> { where: ai = $A; group_by: ai }
            -> { where: ai = $B; group_by: ai }
      `);
      expect(queryGivenIds(md.queryList[0])).toEqual(givenIds(md, 'A', 'B'));
    });

    test('same given referenced twice deduplicates to one entry', () => {
      const md = translateOK(`
        ##! experimental.givens
        given: A :: number is 1
        run: a -> { where: ai = $A; group_by: ai }
            -> { where: ai = $A; group_by: ai }
      `);
      const usage = md.queryList[0].givenUsage ?? [];
      expect(usage).toHaveLength(1);
      expect(usage[0].id).toEqual([...givenIds(md, 'A')][0]);
    });

    test('given inside a nested turtle pipeline reaches outer Query', () => {
      const md = translateOK(`
        ##! experimental.givens
        given:
          A :: number is 1
          B :: number is 2
        run: a -> {
          where: ai = $A
          group_by: ai
          nest: x is { where: ai = $B; group_by: ai }
        }
      `);
      expect(queryGivenIds(md.queryList[0])).toEqual(givenIds(md, 'A', 'B'));
    });
  });

  describe('givens hidden inside a query-source', () => {
    test('input source is a QuerySourceDef wrapping a query that uses $X', () => {
      const md = translateOK(`
        ##! experimental.givens
        given: X :: number is 1
        query: q is a -> { where: ai = $X; group_by: ai }
        source: q_src is q
        run: q_src -> { group_by: ai }
      `);
      // The outer run never names $X, but its input source embeds q which does.
      // givenUsageOfSource(q_src) routes into q.givenUsage.
      expect(queryGivenIds(md.queryList[0])).toEqual(givenIds(md, 'X'));
    });

    test('join target is a QuerySourceDef wrapping a query that uses $X', () => {
      const md = translateOK(`
        ##! experimental.givens
        given: X :: number is 1
        query: q is a -> { where: ai = $X; group_by: ai }
        source: q_src is q
        run: a extend {
          join_one: jq is q_src on ai = jq.ai
        } -> { group_by: ai, jq_ai is jq.ai }
      `);
      // getJoinGivenUsage on jq's SourceDef routes into givenUsageOfSource
      // → q.givenUsage.
      expect(queryGivenIds(md.queryList[0])).toEqual(givenIds(md, 'X'));
    });

    test('chained query sources: q1 wraps q2 wraps $X — outer still sees $X', () => {
      const md = translateOK(`
        ##! experimental.givens
        given: X :: number is 1
        query: q2 is a -> { where: ai = $X; group_by: ai }
        source: q2_src is q2
        query: q1 is q2_src -> { group_by: ai }
        source: q1_src is q1
        run: q1_src -> { group_by: ai }
      `);
      expect(queryGivenIds(md.queryList[0])).toEqual(givenIds(md, 'X'));
    });
  });

  describe('composite sources (best-effort, not the focus)', () => {
    // Composite-source support across the codebase is partially implemented;
    // we're not chasing full coverage in the givens work. What we do verify:
    // when composite resolution DOES run before expandRefUsage (the
    // query-arrow `source ->` path passes `compositeResolvedSourceDef` in),
    // the walker sees only the chosen branch and Query.givenUsage is the
    // minimal set for that branch. Cases where composite resolution doesn't
    // run (e.g. composites as join targets) are not exercised here — the
    // defensive `composite` arm of `givenUsageOfSource` would conservatively
    // union over branches if it were ever reached. See "Composite sources
    // — partial coverage" in ~/ctx/mp/implementation.md.
    test('non-discriminating query picks the first branch', () => {
      const md = translateOK(`
        ##! experimental {composite_sources, givens}
        given:
          X :: number is 1
          Y :: number is 2
        source: c is compose(
          a extend { where: ai = $X },
          a extend { where: ai = $Y }
        )
        run: c -> { group_by: ai }
      `);
      // group_by ai works against either branch; resolution picks branch 1.
      expect(queryGivenIds(md.queryList[0])).toEqual(givenIds(md, 'X'));
    });

    test('query references a branch-2-only field → only branch-2 givens', () => {
      const md = translateOK(`
        ##! experimental {composite_sources, givens}
        given:
          X :: number is 1
          Y :: number is 2
        source: c is compose(
          a extend {
            dimension: foo_a is 1
            where: ai = $X
          },
          a extend {
            dimension: foo_b is 1
            where: ai = $Y
          }
        )
        run: c -> { group_by: foo_b }
      `);
      // group_by foo_b only exists on branch 2; resolution forces branch 2.
      expect(queryGivenIds(md.queryList[0])).toEqual(givenIds(md, 'Y'));
    });
  });

  describe('givens reached via joins', () => {
    test('given in a join `on:` clause flows into Query.givenUsage', () => {
      const md = translateOK(`
        ##! experimental.givens
        given: X :: number is 1
        run: a extend {
          join_one: b on b.ai = $X
        } -> { group_by: b.ai }
      `);
      expect(queryGivenIds(md.queryList[0])).toEqual(givenIds(md, 'X'));
    });

    test('given in a join target source `where:` flows into Query.givenUsage', () => {
      const md = translateOK(`
        ##! experimental.givens
        given: X :: number is 1
        run: a extend {
          join_one: b is a extend { where: ai = $X } on true
        } -> { group_by: b.ai }
      `);
      expect(queryGivenIds(md.queryList[0])).toEqual(givenIds(md, 'X'));
    });

    test('segment-level `extend: { join_one: ... }` — conditional, used: collected', () => {
      const md = translateOK(`
        ##! experimental.givens
        given: X :: number is 1
        run: a -> {
          extend: { join_one: b on b.ai = $X }
          group_by: b.ai
        }
      `);
      // Conditional join activates because b.ai is referenced; on-clause $X
      // flows in via the walker's join-activation path.
      expect(queryGivenIds(md.queryList[0])).toEqual(givenIds(md, 'X'));
    });

    test('segment-level `extend: { join_one: ... }` — conditional, not used: not collected', () => {
      const md = translateOK(`
        ##! experimental.givens
        given: X :: number is 1
        run: a -> {
          extend: { join_one: b on b.ai = $X }
          group_by: ai
        }
      `);
      // Conditional join is declared but nothing reaches through b, so it is
      // never activated. Its $X should NOT appear in Query.givenUsage.
      expect(queryGivenIds(md.queryList[0])).toEqual(new Set());
    });

    test('segment-level direct `join_one:` — always-on join: collected', () => {
      const md = translateOK(`
        ##! experimental.givens
        given: X :: number is 1
        run: a -> {
          join_one: b on b.ai = $X
          group_by: ai
        }
      `);
      // Direct segment-level joins are always activated (they affect the
      // result via filtering/cardinality even without a field reference).
      // The on-clause $X should be collected regardless.
      expect(queryGivenIds(md.queryList[0])).toEqual(givenIds(md, 'X'));
    });
  });
});

describe('given: query satisfiability check', () => {
  // The check fires at end of every translate (Document.compile), regardless
  // of imports. The shape: every Query reachable in the final model — `run:`
  // statements plus named `query: q is ...` entries (local or imported) —
  // has its `query.givenUsage` checked.
  //
  // Two terms worth keeping straight:
  //   - "satisfiable": the given is in this model's namespace (caller can
  //     supply at runtime via .run({givens: {...}})) or has a default.
  //   - "unsatisfiable": neither — there's no path for the value to ever
  //     arrive. That's the translate-time error case.
  //
  // It is OK for a query to have UNSATISFIED givens (no value bound yet,
  // caller will supply at run). It is NOT OK for a query to have
  // UNSATISFIABLE givens (no surface for the caller to bind through).
  //
  // Run-time still has the case-3 throw as a backup if a query somehow
  // makes it past translate with an unbindable given.

  function importTest(parent: string, child: string): TestTranslator {
    const t = new TestTranslator(parent);
    t.unresolved();
    t.update({urls: {'internal://test/langtests/child': child}});
    t.compile();
    return t;
  }

  describe('satisfiable (no error)', () => {
    test('local run: with given in namespace — caller will supply', () => {
      // X is in namespace (the local `given:` declaration surfaces it).
      // No default is required: the caller can bind it via .run({givens}).
      // This is "unsatisfied at translate, satisfiable at runtime" — fine.
      expect(`
        ##! experimental.givens
        given: X :: number
        run: a -> { where: ai = $X; group_by: ai }
      `).toTranslate();
    });

    test('local run: with defaulted given — always satisfied', () => {
      expect(`
        ##! experimental.givens
        given: X :: number is 10
        run: a -> { where: ai = $X; group_by: ai }
      `).toTranslate();
    });

    test('imported source used in a run; given imported by name', () => {
      expect(
        importTest(
          `
          ##! experimental.givens
          import { TENANT, childSrc } from "child"
          run: childSrc -> { select: * }
        `,
          `
          ##! experimental.givens
          given: TENANT :: string
          source: childSrc is a extend { where: astr = $TENANT }
        `
        )
      ).toTranslate();
    });

    test('imported source used in a run; given has default in child', () => {
      expect(
        importTest(
          `
          ##! experimental.givens
          import { childSrc } from "child"
          run: childSrc -> { select: * }
        `,
          `
          ##! experimental.givens
          given: TENANT :: string is "acme"
          source: childSrc is a extend { where: astr = $TENANT }
        `
        )
      ).toTranslate();
    });

    test('imported source NOT used in any query is fine (latent)', () => {
      // The source has an unsatisfiable given but is never run.
      // No Query references it → no Query.givenUsage names that given →
      // nothing to check. Importing latent things is always OK.
      expect(
        importTest(
          `
          ##! experimental.givens
          import { childSrc } from "child"
        `,
          `
          ##! experimental.givens
          given: TENANT :: string
          source: childSrc is a extend { where: astr = $TENANT }
        `
        )
      ).toTranslate();
    });

    test('imported source with view referencing unsatisfiable given is OK if view is never invoked', () => {
      expect(
        importTest(
          `
          ##! experimental.givens
          import { childSrc } from "child"
          run: childSrc -> { select: * }
        `,
          `
          ##! experimental.givens
          given: X :: number
          source: childSrc is a extend {
            view: v is { where: ai = $X; group_by: ai }
          }
        `
        )
      ).toTranslate();
    });

    test('imported source with dimension referencing unsatisfiable given is OK if dimension is never selected', () => {
      // `select: *` on `a` doesn't touch the extension's `d`, only a's
      // own columns; the dimension's $X is never reached.
      expect(
        importTest(
          `
          ##! experimental.givens
          import { childSrc } from "child"
          run: childSrc -> { group_by: ai }
        `,
          `
          ##! experimental.givens
          given: X :: number
          source: childSrc is a extend { dimension: d is ai + $X }
        `
        )
      ).toTranslate();
    });
  });

  describe('unsatisfiable (translate-time error)', () => {
    test('local run: references a given with no default and not in namespace: error', () => {
      // The given is declared in some imported child but never surfaced
      // here, so the local run statement has no path to a value. Error
      // message mentions the given's readable surface name (TENANT), not
      // the opaque GivenID.
      expect(
        importTest(
          `
          ##! experimental.givens
          import { childSrc } from "child"
          run: childSrc -> { select: * }
        `,
          `
          ##! experimental.givens
          given: TENANT :: string
          source: childSrc is a extend { where: astr = $TENANT }
        `
        )
      ).toLog(
        errorMessage(
          /run: statement references given `TENANT`.*not surfaced in this model and has no default/
        )
      );
    });

    test('local query: with unsatisfiable given errors at translate', () => {
      // Same shape via a named query rather than a run.
      expect(
        importTest(
          `
          ##! experimental.givens
          import { childSrc } from "child"
          query: q is childSrc -> { select: * }
        `,
          `
          ##! experimental.givens
          given: TENANT :: string
          source: childSrc is a extend { where: astr = $TENANT }
        `
        )
      ).toLog(
        errorMessage(
          /references given .* which is not surfaced in this model and has no default/
        )
      );
    });

    test('imported named query that is unsatisfiable in importer errors', () => {
      // child has the given, child has the named query. importer pulls in
      // the named query without surfacing the given → unsatisfiable here.
      expect(
        importTest(
          `
          ##! experimental.givens
          import { childQuery } from "child"
        `,
          `
          ##! experimental.givens
          given: MAX_ROWS :: number
          query: childQuery is a -> { where: ai = $MAX_ROWS; group_by: ai }
        `
        )
      ).toLog(
        errorMessage(
          /references given .* which is not surfaced in this model and has no default/
        )
      );
    });

    test('local given with same surface NAME does NOT satisfy (ids are file-scoped)', () => {
      // A's local `given: TENANT` and child's `given: TENANT` are
      // different givens — the GivenID is per-file, so sharing a surface
      // name doesn't merge them. To bridge, import child's TENANT
      // explicitly (optionally with rename).
      expect(
        importTest(
          `
          ##! experimental.givens
          import { childSrc } from "child"
          given: TENANT :: string is "local-default"
          run: childSrc -> { select: * }
        `,
          `
          ##! experimental.givens
          given: TENANT :: string
          source: childSrc is a extend { where: astr = $TENANT }
        `
        )
      ).toLog(
        errorMessage(
          /references given .* which is not surfaced in this model and has no default/
        )
      );
    });

    test('cross-cell: import source in cell 1 (no use), use in cell 2 errors in cell 2', () => {
      // Mirrors what a notebook does via extendModel: cell 1 produces a
      // modelDef, cell 2 translates with that modelDef inherited. The
      // unsatisfiable reference never fires in cell 1 (no Query touches
      // it) but DOES fire in cell 2 once a run statement uses the
      // imported source. TestTranslator's optional `internalModel`
      // constructor arg is the test-side equivalent of extendModel.
      const cell1 = new TestTranslator(`
        ##! experimental.givens
        import { childSrc } from "child"
      `);
      cell1.unresolved();
      cell1.update({
        urls: {
          'internal://test/langtests/child': `
            ##! experimental.givens
            given: TENANT :: string
            source: childSrc is a extend { where: astr = $TENANT }
          `,
        },
      });
      cell1.translate();
      expect(cell1).toTranslate();
      const cell1Model = cell1.modelDef;
      // Cell 2 has no imports of its own; childSrc comes through the
      // inherited modelDef. The new run is the first thing that surfaces
      // the unsatisfiable given.
      const cell2 = new TestTranslator(
        `
        ##! experimental.givens
        run: childSrc -> { select: * }
      `,
        null,
        null,
        'malloyDocument',
        cell1Model
      );
      cell2.translate();
      expect(cell2).toLog(
        errorMessage(
          /references given .* which is not surfaced in this model and has no default/
        )
      );
    });

    test('default that references an unsatisfiable given is itself unsatisfiable', () => {
      // A is satisfied by its default `$B + 1`, BUT B has no default and
      // (in the importer below) is not surfaced. The runtime needs B's
      // value to evaluate A's default, so the chain is unsatisfiable
      // end-to-end. The check must follow the chain, not stop at "A has
      // a default."
      expect(
        importTest(
          `
          ##! experimental.givens
          import { childSrc } from "child"
          run: childSrc -> { select: * }
        `,
          `
          ##! experimental.givens
          given:
            B :: number
            A :: number is $B + 1
          source: childSrc is a extend { where: ai = $A }
        `
        )
      ).toLog(
        errorMessage(
          /references given `B`.*not surfaced in this model and has no default/
        )
      );
    });

    test('default chain that bottoms out in a surfaced given is satisfiable', () => {
      // A has default `$B + 1`; B has no default but IS in the importer's
      // namespace (caller can supply). The chain A → B is satisfiable.
      expect(
        importTest(
          `
          ##! experimental.givens
          import { B, childSrc } from "child"
          run: childSrc -> { select: * }
        `,
          `
          ##! experimental.givens
          given:
            B :: number
            A :: number is $B + 1
          source: childSrc is a extend { where: ai = $A }
        `
        )
      ).toTranslate();
    });

    test('3-deep default chain: only the bottom unsatisfiable id surfaces', () => {
      // Q references A. A defaults to $B + 1. B defaults to $C * 2.
      // C has no default. None of A, B, C are surfaced in the importer.
      // The chain A → B → C is unsatisfiable BECAUSE OF C — A and B both
      // have defaults; C is the missing link. Only C should error.
      expect(
        importTest(
          `
          ##! experimental.givens
          import { childSrc } from "child"
          run: childSrc -> { select: * }
        `,
          `
          ##! experimental.givens
          given:
            C :: number
            B :: number is $C * 2
            A :: number is $B + 1
          source: childSrc is a extend { where: ai = $A }
        `
        )
      ).toLog(
        errorMessage(
          /references given `C`.*not surfaced in this model and has no default/
        )
      );
    });

    test('view invoked via run: surfaces the unsatisfiable given', () => {
      // The same view that's silently OK when not invoked becomes a
      // translate-time error when used.
      expect(
        importTest(
          `
          ##! experimental.givens
          import { childSrc } from "child"
          run: childSrc -> v
        `,
          `
          ##! experimental.givens
          given: X :: number
          source: childSrc is a extend {
            view: v is { where: ai = $X; group_by: ai }
          }
        `
        )
      ).toLog(
        errorMessage(
          /references given .* which is not surfaced in this model and has no default/
        )
      );
    });
  });
});

describe('given: PreparedQuery.givens introspection', () => {
  // Compile a Malloy source through TestTranslator and return a Model
  // wrapper plus the raw modelDef. Throws if the source has problems.
  function modelFromSource(src: string): {model: Model; md: ModelDef} {
    const t = new TestTranslator(src);
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    return {model: new Model(md, [], []), md};
  }

  test('returns the givens this query references, keyed by surface name', () => {
    const {model} = modelFromSource(`
      ##! experimental.givens
      given:
        A :: number is 1
        B :: number is 2
        C :: number is 3
      query: q is a -> { where: ai = $A and ai = $B; group_by: ai }
    `);
    const givens = model.getPreparedQueryByName('q').givens;
    expect([...givens.keys()].sort()).toEqual(['A', 'B']);
    expect(givens.has('C')).toBe(false);
  });

  test('empty Map for a query that uses no givens', () => {
    const {model} = modelFromSource(`
      ##! experimental.givens
      given: A :: number is 1
      query: q is a -> { group_by: ai }
    `);
    const givens = model.getPreparedQueryByName('q').givens;
    expect(givens.size).toBe(0);
  });

  test('Given wrapper exposes name, id, type, default, location', () => {
    const {model, md} = modelFromSource(`
      ##! experimental.givens
      given: TENANT :: string is "acme"
      query: q is a -> { where: astr = $TENANT; group_by: astr }
    `);
    const givens = model.getPreparedQueryByName('q').givens;
    const t = givens.get('TENANT');
    expect(t).toBeDefined();
    expect(t?.name).toBe('TENANT');
    expect(t?.type).toEqual({type: 'string'});
    // Default is the IR ConstantExpr; we just check shape (it's the
    // string literal "acme") rather than full IR equality.
    expect(t?.default).toMatchObject({node: 'stringLiteral'});
    expect(t?.location).toBeDefined();
    // id matches what the model recorded for TENANT.
    const expectedId = givenId(md, 'TENANT');
    expect(t?.id).toBe(expectedId);
  });

  test('undefaulted given has default === undefined (not missing)', () => {
    const {model} = modelFromSource(`
      ##! experimental.givens
      given: REQUIRED :: number
      query: q is a -> { where: ai = $REQUIRED; group_by: ai }
    `);
    const givens = model.getPreparedQueryByName('q').givens;
    const r = givens.get('REQUIRED');
    expect(r).toBeDefined();
    expect(r?.default).toBeUndefined();
  });

  test('renamed-on-import: surface name is the importer rename', () => {
    const t = new TestTranslator(`
      ##! experimental.givens
      import { CAP is MAX_ROWS } from "child"
      query: q is a -> { where: ai = $CAP; group_by: ai }
    `);
    t.unresolved();
    t.update({
      urls: {
        'internal://test/langtests/child': `
          ##! experimental.givens
          given: MAX_ROWS :: number is 100
        `,
      },
    });
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    const model = new Model(md, [], []);
    const givens = model.getPreparedQueryByName('q').givens;
    expect([...givens.keys()]).toEqual(['CAP']);
    // Under the rename, the GivenID stays the imported file's id, but
    // the surface name in the importer is `CAP`.
    expect(givens.get('CAP')?.name).toBe('CAP');
  });

  test('two surface aliases to the same id are rejected as a collision', () => {
    const t = new TestTranslator(`
      ##! experimental.givens
      import { MAX_ROWS } from "child"
      import { CAP is MAX_ROWS } from "child"
      query: q is a -> { where: ai = $MAX_ROWS and ai > $CAP; group_by: ai }
    `);
    t.unresolved();
    t.update({
      urls: {
        'internal://test/langtests/child': `
          ##! experimental.givens
          given: MAX_ROWS :: number is 100
        `,
      },
    });
    expect(t).toLog(errorMessage(/surfaced under multiple names/));
  });

  test('annotations on the given declaration surface via tagParse / getTaglines', () => {
    const {model} = modelFromSource(`
      ##! experimental.givens
      given:
        # label="Tenant"
        TENANT :: string is "acme"
      query: q is a -> { where: astr = $TENANT; group_by: astr }
    `);
    const givens = model.getPreparedQueryByName('q').givens;
    const t = givens.get('TENANT');
    expect(t).toBeDefined();
    const taglines = t?.getTaglines();
    expect(taglines).toEqual(expect.arrayContaining(['# label="Tenant"\n']));
    // tagParse returns a structured Tag — confirm the label is parseable.
    const parsed = t?.tagParse();
    expect(parsed?.tag.text('label')).toBe('Tenant');
  });

  test('run: statement (no name) — getPreparedQueryByIndex works the same way', () => {
    const {model} = modelFromSource(`
      ##! experimental.givens
      given: X :: number is 1
      run: a -> { where: ai = $X; group_by: ai }
    `);
    const pq = model.getPreparedQueryByIndex(0);
    const givens = pq.givens;
    expect([...givens.keys()]).toEqual(['X']);
  });

  test('Given is the right shape (compile-time type sanity)', () => {
    const {model} = modelFromSource(`
      ##! experimental.givens
      given: X :: number is 1
      query: q is a -> { where: ai = $X; group_by: ai }
    `);
    const givens = model.getPreparedQueryByName('q').givens;
    const x: Given | undefined = givens.get('X');
    expect(x).toBeDefined();
    // The map is read-only; no `.set` or `.delete`. TypeScript catches
    // attempts at compile time; not asserted here at runtime.
  });
});

describe('given: Model.givens introspection', () => {
  function modelFromSource(src: string): {model: Model; md: ModelDef} {
    const t = new TestTranslator(src);
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    return {model: new Model(md, [], []), md};
  }

  test('returns every surfaced given keyed by surface name', () => {
    const {model} = modelFromSource(`
      ##! experimental.givens
      given:
        A :: number is 1
        B :: string is "hi"
        C :: boolean
    `);
    const givens = model.givens;
    expect([...givens.keys()].sort()).toEqual(['A', 'B', 'C']);
  });

  test('empty Map when no givens declared', () => {
    const {model} = modelFromSource(`
      ##! experimental.givens
      run: a -> { group_by: ai }
    `);
    expect(model.givens.size).toBe(0);
  });

  test('Given wrapper exposes type, default, location, name, id', () => {
    const {model, md} = modelFromSource(`
      ##! experimental.givens
      given: TENANT :: string is "acme"
    `);
    const t = model.givens.get('TENANT');
    expect(t).toBeDefined();
    expect(t?.name).toBe('TENANT');
    expect(t?.type).toEqual({type: 'string'});
    expect(t?.default).toMatchObject({node: 'stringLiteral'});
    expect(t?.location).toBeDefined();
    expect(t?.id).toBe(givenId(md, 'TENANT'));
  });

  test('undefaulted given has default === undefined', () => {
    const {model} = modelFromSource(`
      ##! experimental.givens
      given: REQUIRED :: number
    `);
    expect(model.givens.get('REQUIRED')?.default).toBeUndefined();
  });

  test('imported given uses its imported surface name', () => {
    const t = new TestTranslator(`
      ##! experimental.givens
      import { CAP is MAX_ROWS } from "child"
    `);
    t.unresolved();
    t.update({
      urls: {
        'internal://test/langtests/child': `
          ##! experimental.givens
          given: MAX_ROWS :: number is 100
        `,
      },
    });
    expect(t).toTranslate();
    const model = new Model(t.translate().modelDef!, [], []);
    const givens = model.givens;
    expect([...givens.keys()]).toEqual(['CAP']);
    expect(givens.get('CAP')?.name).toBe('CAP');
  });

  test('two surface aliases to the same id are rejected as a collision', () => {
    const t = new TestTranslator(`
      ##! experimental.givens
      import { MAX_ROWS } from "child"
      import { CAP is MAX_ROWS } from "child"
    `);
    t.unresolved();
    t.update({
      urls: {
        'internal://test/langtests/child': `
          ##! experimental.givens
          given: MAX_ROWS :: number is 100
        `,
      },
    });
    expect(t).toLog(errorMessage(/surfaced under multiple names/));
  });

  test('annotations on given declarations surface via tagParse / getTaglines', () => {
    const {model} = modelFromSource(`
      ##! experimental.givens
      given:
        # label="Tenant"
        TENANT :: string is "acme"
    `);
    const t = model.givens.get('TENANT');
    expect(t?.getTaglines()).toEqual(
      expect.arrayContaining(['# label="Tenant"\n'])
    );
    expect(t?.tagParse().tag.text('label')).toBe('Tenant');
  });

  test('non-selectively-imported given appears in Model.givens under its original name', () => {
    // `import "child"` auto-surfaces child's givens into the importer's
    // namespace under their original names; Model.givens picks them up.
    const t = new TestTranslator(`
      ##! experimental.givens
      import "child"
    `);
    t.unresolved();
    t.update({
      urls: {
        'internal://test/langtests/child': `
          ##! experimental.givens
          given: TENANT :: string is "acme"
        `,
      },
    });
    expect(t).toTranslate();
    const model = new Model(t.translate().modelDef!, [], []);
    expect(model.givens.size).toBe(1);
    expect(model.givens.get('TENANT')?.type).toEqual({type: 'string'});
  });

  test('Model.queryModel loads cleanly when contents has given entries', () => {
    // Regression: ModelDef.contents can hold GivenEntry rows; the
    // QueryModel loader needs to know how to skip them. Before the fix
    // it threw 'Internal Error: Unknown structure type' on any model
    // that declared a given, even if no query referenced one.
    const {model} = modelFromSource(`
      ##! experimental.givens
      given:
        TENANT :: string is "acme"
        MAX_ROWS :: number is 1000
      query: q is a -> { group_by: ai }
    `);
    // Force lazy QueryModel construction.
    expect(() => model.queryModel).not.toThrow();
    // And the actual query still resolves.
    expect(
      () => model.getPreparedQueryByName('q').preparedResult
    ).not.toThrow();
  });

  test('PreparedQuery.givens is the per-query subset of Model.givens', () => {
    // The two introspection accessors return Given wrappers from the
    // same underlying records, with PreparedQuery.givens being a strict
    // subset filtered by the query's `givenUsage`.
    const {model} = modelFromSource(`
      ##! experimental.givens
      given:
        USED :: number is 1
        UNUSED :: number is 2
      query: q is a -> { where: ai = $USED; group_by: ai }
    `);
    const all = model.givens;
    expect([...all.keys()].sort()).toEqual(['UNUSED', 'USED']);
    const perQuery = model.getPreparedQueryByName('q').givens;
    expect([...perQuery.keys()]).toEqual(['USED']);
    // Same id on both sides for the shared given.
    expect(all.get('USED')?.id).toBe(perQuery.get('USED')?.id);
  });
});

describe('expr in $ARRAY_GIVEN', () => {
  test('parses as ExprInGiven', () => {
    const e = givenExpr`astr in $STATES`.translator.ast();
    expect(e).toBeInstanceOf(ExprInGiven);
    if (e instanceof ExprInGiven) {
      expect(e.notIn).toBe(false);
      expect(e.givenRef).toBeInstanceOf(GivenReference);
      expect(e.givenRef.name).toEqual('STATES');
    }
  });

  test('not-in form sets notIn=true', () => {
    const e = givenExpr`astr not in $STATES`.translator.ast();
    expect(e).toBeInstanceOf(ExprInGiven);
    if (e instanceof ExprInGiven) {
      expect(e.notIn).toBe(true);
    }
  });

  test('produces an inGiven IR node referencing the given', () => {
    const t = new TestTranslator(`
      ##! experimental.givens
      given: STATES :: string[] is ['CA']
      run: a -> { where: astr in $STATES; select: * }
    `);
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    const filter = md.queryList[0].pipeline[0].filterList![0];
    expect(filter).toBeExpr('{filterCondition {astr in $STATES}}');
  });

  test('not-in form produces a negated inGiven IR node', () => {
    const t = new TestTranslator(`
      ##! experimental.givens
      given: STATES :: string[] is ['CA']
      run: a -> { where: astr not in $STATES; select: * }
    `);
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    const filter = md.queryList[0].pipeline[0].filterList![0];
    expect(filter).toBeExpr('{filterCondition {astr not in $STATES}}');
  });

  test('LHS basic type must match array element type', () => {
    // ai is a number; $STATES is string[] → mismatch.
    expect(`
      ##! experimental.givens
      given: STATES :: string[] is ['CA']
      run: a -> { where: ai in $STATES; select: * }
    `).toLog(errorMessage(/does not match the array element type/));
  });

  test('RHS must be array-typed', () => {
    expect(`
      ##! experimental.givens
      given: TENANT :: string
      run: a -> { where: astr in $TENANT; select: * }
    `).toLog(errorMessage(/requires `TENANT` to be an array/));
  });

  test('experimental.givens flag required', () => {
    // Multiple sites in the source touch the experimental flag; we just
    // assert at least one flag-required error is raised — no claim
    // about other downstream errors.
    expect(`
      run: a -> { where: astr in $STATES; select: * }
    `).toLogAtLeast(errorMessage(/Experimental flag `givens` is not set/));
  });

  test('unknown given name surfaces the standard given-not-found error', () => {
    expect(`
      ##! experimental.givens
      run: a -> { where: astr in $NOPE; select: * }
    `).toLog(
      errorMessage(/references a given named `NOPE`, which is not declared/)
    );
  });
});

describe('inline givens', () => {
  test('declaration parses and sets inline=true on the AST', () => {
    const givens = onlyGivens('given: inline OK :: boolean is true');
    expect(givens).toHaveLength(1);
    expect(givens[0].name).toEqual('OK');
    expect(givens[0].inline).toBe(true);
  });

  test('regular (non-inline) given has inline=false on the AST', () => {
    const givens = onlyGivens('given: REG :: number is 42');
    expect(givens[0].inline).toBe(false);
  });

  test('the inline modifier is case-insensitive', () => {
    const givens = onlyGivens(`
      given:
        inline LOWER :: boolean is true
        INLINE UPPER :: boolean is true
        Inline MIXED :: boolean is true
    `);
    expect(givens.map(g => g.inline)).toEqual([true, true, true]);
  });

  test('any modifier other than `inline` is a translate-time error', () => {
    expect(`
      ##! experimental.givens
      given: nonsense FOO :: boolean is true
    `).toLogAtLeast(errorMessage(/Unknown modifier `nonsense`/));
  });

  test('inline flag survives into the IR Given record', () => {
    const t = new TestTranslator(`
      ##! experimental.givens
      given:
        ROLE :: string is "viewer"
        inline IS_ADMIN :: boolean is $ROLE = "admin"
    `);
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    expect(md.givens![givenId(md, 'ROLE')].inline).toBeUndefined();
    expect(md.givens![givenId(md, 'IS_ADMIN')].inline).toBe(true);
  });

  test('inline given without a default is a translate-time error', () => {
    expect(`
      ##! experimental.givens
      given: inline FOO :: number
    `).toLog(errorMessage(/inline given `FOO` must have a value/));
  });

  test('inline default with a disallowed operator is a translate-time error', () => {
    // Arithmetic is not in the initial inline operator set.
    expect(`
      ##! experimental.givens
      given:
        N :: number is 10
        inline DOUBLED :: number is $N + 1
    `).toLog(
      errorMessage(/inline given `DOUBLED` uses operator\(s\) not allowed/)
    );
  });

  test('inline default with only allowed operators translates cleanly', () => {
    expect(`
      ##! experimental.givens
      given:
        CAPS :: string[]
        ROLE :: string
        inline CAN_READ :: boolean is 'read' in $CAPS
        inline CAN_MUTATE :: boolean is 'write' in $CAPS or $ROLE = 'admin'
    `).toTranslate();
  });

  test('inline given filtered out of Model.givens introspection', () => {
    const t = new TestTranslator(`
      ##! experimental.givens
      given:
        TENANT :: string is "acme"
        inline DERIVED :: boolean is $TENANT = "acme"
    `);
    expect(t).toTranslate();
    const model = new Model(t.translate().modelDef!, [], []);
    const names = [...model.givens.keys()].sort();
    expect(names).toEqual(['TENANT']);
  });

  test('inline given still appears in modelDef.contents (not API-filtered there)', () => {
    // ModelDef.contents is the source of truth for the namespace; filtering
    // happens only at the foundation-API layer.
    const t = new TestTranslator(`
      ##! experimental.givens
      given:
        ROLE :: string is "viewer"
        inline IS_ADMIN :: boolean is $ROLE = "admin"
    `);
    expect(t).toTranslate();
    const md = t.translate().modelDef!;
    expect(md.contents['IS_ADMIN']?.type).toBe('given');
  });
});
