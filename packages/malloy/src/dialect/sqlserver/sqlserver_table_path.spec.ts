/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {SQLServerDialect} from './sqlserver';

// The shared grammar in escape.spec.ts covers bare and ANSI-quoted segments;
// this pins the bracket form SQL Server users write, and its canonical form.
describe('sqlserver table paths', () => {
  const d = new SQLServerDialect();
  const canonical = (input: string) => {
    const r = d.sqlValidateTableName(input);
    return r.ok ? r.canonical : `ERROR: ${r.error}`;
  };

  test('bracketed segments canonicalize to ANSI quotes', () => {
    expect(canonical('[malloytest].[state_facts]')).toBe(
      '"malloytest"."state_facts"'
    );
    expect(canonical('[db].[schema].[table]')).toBe('"db"."schema"."table"');
  });

  test('mixed bare, bracketed and quoted segments', () => {
    expect(canonical('malloytest.[state facts]')).toBe(
      'malloytest."state facts"'
    );
    expect(canonical('"a".[b].c')).toBe('"a"."b".c');
  });

  test(']] escapes a bracket, and a quote inside a bracket is doubled', () => {
    expect(canonical('[we]]ird]')).toBe('"we]ird"');
    expect(canonical('[say "hi"]')).toBe('"say ""hi"""');
  });

  test('brackets inside an ANSI-quoted segment are literal', () => {
    expect(canonical('"[not a bracket]"')).toBe('"[not a bracket]"');
  });

  test('an unterminated bracket is rejected', () => {
    expect(canonical('[oops')).toMatch(/unterminated bracketed/);
  });

  test('forbidden characters are rejected even in brackets', () => {
    expect(canonical('[x;drop]')).toMatch(/forbidden/);
  });
});
