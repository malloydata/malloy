/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {compileModel, compileQuery, compileSource} from './sessioned';
import type * as Malloy from '@malloydata/malloy-interfaces';

// Everything the driver can hand back to the compiler, indexed by request.
interface SessionFixtures {
  files?: Record<string, string>; // url -> contents
  dialects?: Record<string, string>; // connection name -> dialect
  tables?: Record<string, Malloy.Schema>; // `${connection}:${table}` -> schema
  sqls?: Record<string, Malloy.Schema>; // `${connection}:${selectStr}` -> schema
}

// Answer one round of compiler needs from the fixtures. We don't care which
// needs arrive in which round — whatever is asked for, we fill from the same
// flat fixture set. Unknown items get no payload (the compiler will error).
function fulfill(
  needs: Malloy.CompilerNeeds,
  fx: SessionFixtures
): Malloy.CompilerNeeds {
  const out: Malloy.CompilerNeeds = {};
  if (needs.files) {
    out.files = needs.files.map(f => ({
      ...f,
      contents: fx.files?.[f.url] ?? '',
    }));
  }
  if (needs.connections) {
    out.connections = needs.connections.map(c => ({
      ...c,
      dialect: fx.dialects?.[c.name],
    }));
  }
  if (needs.table_schemas) {
    out.table_schemas = needs.table_schemas.map(t => ({
      ...t,
      schema: fx.tables?.[`${t.connection_name}:${t.name}`],
    }));
  }
  if (needs.sql_schemas) {
    out.sql_schemas = needs.sql_schemas.map(s => ({
      ...s,
      schema: fx.sqls?.[`${s.connection_name}:${s.sql}`],
    }));
  }
  return out;
}

// Drive a stateful compile to completion, answering whatever the compiler asks
// for from `fx` each round — regardless of how many rounds it takes or which
// order dialects, tables, and files are requested in. `step` runs one compile
// call given the needs to feed and the session to resume.
function runToCompletion<
  R extends {compiler_needs?: Malloy.CompilerNeeds; session_id?: string},
>(
  step: (
    needs: Malloy.CompilerNeeds | undefined,
    session_id: string | undefined
  ) => R,
  fx: SessionFixtures
): R {
  let needs: Malloy.CompilerNeeds | undefined;
  let session_id: string | undefined;
  for (let round = 0; round < 20; round++) {
    const result = step(needs, session_id);
    session_id = result.session_id;
    if (result.compiler_needs === undefined) return result;
    needs = fulfill(result.compiler_needs, fx);
  }
  throw new Error('runToCompletion: compile did not converge in 20 rounds');
}

describe('api', () => {
  describe('compile model', () => {
    test('compile model with table dependency', () => {
      const fx: SessionFixtures = {
        files: {
          'file://test.malloy':
            "# someannotation=foo\n source: flights is connection.table('flights')",
        },
        dialects: {connection: 'duckdb'},
        tables: {
          'connection:flights': {
            fields: [
              {kind: 'dimension', name: 'carrier', type: {kind: 'string_type'}},
            ],
          },
        },
      };
      const result = runToCompletion(
        (compiler_needs, session_id) =>
          compileModel(
            {model_url: 'file://test.malloy', compiler_needs},
            session_id === undefined ? undefined : {session_id}
          ),
        fx
      );
      expect(result).toMatchObject({
        model: {
          entries: [
            {
              kind: 'source',
              name: 'flights',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'carrier',
                    type: {kind: 'string_type'},
                  },
                ],
              },
              annotations: [{value: '# someannotation=foo\n'}],
            },
          ],
          anonymous_queries: [],
        },
      });
    });
    test('compile source basic test', () => {
      const fx: SessionFixtures = {
        files: {
          'file://test.malloy':
            "source: flights is connection.table('flights')",
        },
        dialects: {connection: 'duckdb'},
        tables: {
          'connection:flights': {
            fields: [
              {kind: 'dimension', name: 'carrier', type: {kind: 'string_type'}},
            ],
          },
        },
      };
      const result = runToCompletion(
        (compiler_needs, session_id) =>
          compileSource(
            {model_url: 'file://test.malloy', name: 'flights', compiler_needs},
            session_id === undefined ? undefined : {session_id}
          ),
        fx
      );
      expect(result).toMatchObject({
        source: {
          name: 'flights',
          schema: {
            fields: [
              {kind: 'dimension', name: 'carrier', type: {kind: 'string_type'}},
            ],
          },
        },
      });
    });
  });
  describe('compile query', () => {
    test('compile query with table dependency', () => {
      const query: Malloy.Query = {
        definition: {
          kind: 'arrow',
          source: {kind: 'source_reference', name: 'flights'},
          view: {
            kind: 'segment',
            operations: [
              {
                kind: 'group_by',
                field: {
                  expression: {kind: 'field_reference', name: 'carrier'},
                },
              },
            ],
          },
        },
      };
      const fx: SessionFixtures = {
        files: {
          'file://test.malloy':
            "source: flights is connection.table('flights')",
        },
        dialects: {connection: 'duckdb'},
        tables: {
          'connection:flights': {
            fields: [
              {kind: 'dimension', name: 'carrier', type: {kind: 'string_type'}},
            ],
          },
        },
      };
      const result = runToCompletion(
        (compiler_needs, session_id) =>
          compileQuery(
            {model_url: 'file://test.malloy', query, compiler_needs},
            session_id === undefined ? undefined : {session_id}
          ),
        fx
      );
      expect(result).toMatchObject({
        result: {
          connection_name: 'connection',
          sql: `SELECT \n\
   base."carrier" as "carrier"
FROM flights as base
GROUP BY 1
ORDER BY 1 asc NULLS LAST
`,
          schema: {
            fields: [
              {kind: 'dimension', name: 'carrier', type: {kind: 'string_type'}},
            ],
          },
        },
      });
    });
  });
  describe('sessions', () => {
    describe('ttl', () => {
      test('making a different request should purge expired sessions', () => {
        let result = compileModel(
          {
            model_url: 'file://test.malloy',
          },
          {
            // This is in the past...
            ttl: new Date(Date.now() - 1000),
          }
        );
        const session_id = result.session_id;
        let expected: Malloy.CompileModelResponse = {
          compiler_needs: {
            files: [
              {
                url: 'file://test.malloy',
              },
            ],
          },
        };
        expect(result).toMatchObject(expected);
        compileModel({
          model_url: 'file://some_other_model.malloy',
        });
        result = compileModel({model_url: 'file://test.malloy'}, {session_id});
        expected = {
          compiler_needs: {
            files: [
              {
                url: 'file://test.malloy',
              },
            ],
          },
        };
        expect(result).toMatchObject(expected);
        // New session
        expect(result.session_id).not.toBe(session_id);
      });
      test('ttl should be updated if set in a subsequent request', () => {
        let result = compileModel(
          {
            model_url: 'file://test.malloy',
          },
          {
            // This is in the past...
            ttl: new Date(Date.now() - 1000),
          }
        );
        const session_id = result.session_id;
        expect(result.compiler_needs).toBeDefined();
        // Advance the session one round and push its TTL into the future.
        result = compileModel(
          {
            model_url: 'file://test.malloy',
            compiler_needs: {
              files: [
                {
                  url: 'file://test.malloy',
                  contents: 'source: flights is connection.table("flights")',
                },
              ],
            },
          },
          {
            session_id,
            // Update TTL to be far in the future
            ttl: {seconds: 100000},
          }
        );
        expect(result.session_id).toBe(session_id);
        // The session is mid-flight; capture wherever it is without caring
        // which needs the compiler asked for.
        const midFlight = result.compiler_needs;
        expect(midFlight).toBeDefined();
        // Now asking for a different file should NOT purge the original session
        compileModel({
          model_url: 'file://some_other_model.malloy',
        });
        // Re-entering the session resumes exactly where it left off.
        result = compileModel({model_url: 'file://test.malloy'}, {session_id});
        expect(result.session_id).toBe(session_id);
        expect(result.compiler_needs).toEqual(midFlight);
      });
    });
    test('getting an error should kill session', () => {
      let result = compileModel({
        model_url: 'file://test.malloy',
        compiler_needs: {
          files: [
            {
              url: 'file://test.malloy',
              contents:
                "source: flights is connection.table('flights') extend { dimension: x is does_not_exist }",
            },
          ],
          table_schemas: [
            {
              connection_name: 'connection',
              name: 'flights',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'carrier',
                    type: {kind: 'string_type'},
                  },
                ],
              },
            },
          ],
          connections: [{name: 'connection', dialect: 'duckdb'}],
        },
      });
      let expected: Malloy.CompileModelResponse = {
        logs: [
          {
            url: 'file://test.malloy',
            severity: 'error',
            message: "'does_not_exist' is not defined",
            range: {
              start: {line: 0, character: 72},
              end: {line: 0, character: 86},
            },
          },
        ],
      };
      const session_id = result.session_id;
      expect(result).toMatchObject(expected);
      result = compileModel({model_url: 'file://test.malloy'}, {session_id});
      expected = {
        compiler_needs: {
          files: [
            {
              url: 'file://test.malloy',
            },
          ],
        },
      };
      expect(result).toMatchObject(expected);
      // Should be a new session
      expect(result.session_id).not.toBe(session_id);
    });
    test('sessions should be cleared when they successfully return a result', () => {
      let result = compileModel({
        model_url: 'file://test.malloy',
        compiler_needs: {
          table_schemas: [
            {
              connection_name: 'connection',
              name: 'flights',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'carrier',
                    type: {kind: 'string_type'},
                  },
                ],
              },
            },
          ],
          files: [
            {
              url: 'file://test.malloy',
              contents: "source: flights is connection.table('flights')",
            },
          ],
          connections: [{name: 'connection', dialect: 'duckdb'}],
        },
      });
      let expected: Malloy.CompileModelResponse = {
        model: {
          entries: [
            {
              kind: 'source',
              name: 'flights',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'carrier',
                    type: {kind: 'string_type'},
                  },
                ],
              },
            },
          ],
          anonymous_queries: [],
        },
      };
      const session_id = result.session_id;
      expect(result).toMatchObject(expected);
      expect(result.translations).not.toBeUndefined();
      expect(result.translations!.length).toBe(1);
      result = compileModel({model_url: 'file://test.malloy'}, {session_id});
      // Compiler should not know the contents of this file anymore because the session was cleared
      expected = {
        compiler_needs: {
          files: [
            {
              url: 'file://test.malloy',
            },
          ],
        },
      };
      expect(result).toMatchObject(expected);
      expect(result.session_id).not.toBe(session_id);
    });

    test('sessions that provide translation in compiler needs compiles model correctly', () => {
      const result = compileModel({
        model_url: 'file://test.malloy',
        compiler_needs: {
          files: [],
          translations: [
            {
              url: 'file://test.malloy',
              compiled_model_json:
                '{"name":"","exports":["flights"],"contents":{"flights":{"type":"table","tablePath":"flights","connection":"connection","dialect":"duckdb","fields":[{"type":"string","name":"carrier","location":{"url":"file://test.malloy","range":{"start":{"line":0,"character":19},"end":{"line":0,"character":46}}}}],"name":"connection:flights","location":{"url":"file://test.malloy","range":{"start":{"line":0,"character":8},"end":{"line":0,"character":46}}},"parameters":{},"as":"flights"}},"queryList":[],"dependencies":{},"references":[],"imports":[]}',
            },
          ],
        },
      });
      const expected: Malloy.CompileModelResponse = {
        model: {
          entries: [
            {
              kind: 'source',
              name: 'flights',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'carrier',
                    type: {kind: 'string_type'},
                  },
                ],
              },
            },
          ],
          anonymous_queries: [],
        },
      };
      expect(result).toMatchObject(expected);
    });

    test('sessions that translation after first call in compiler needs compiles model correctly', () => {
      const result = compileModel({
        model_url: 'file://test.malloy',
      });
      const expected: Malloy.CompileModelResponse = {
        compiler_needs: {
          files: [
            {
              url: 'file://test.malloy',
            },
          ],
        },
      };

      expect(result).toMatchObject(expected);

      const session_id = result.session_id;
      const resultSecondCall = compileModel(
        {
          model_url: 'file://test.malloy',
          compiler_needs: {
            files: [],
            translations: [
              {
                url: 'file://test.malloy',
                compiled_model_json:
                  '{"name":"","exports":["flights"],"contents":{"flights":{"type":"table","tablePath":"flights","connection":"connection","dialect":"duckdb","fields":[{"type":"string","name":"carrier","location":{"url":"file://test.malloy","range":{"start":{"line":0,"character":19},"end":{"line":0,"character":46}}}}],"name":"connection:flights","location":{"url":"file://test.malloy","range":{"start":{"line":0,"character":8},"end":{"line":0,"character":46}}},"parameters":{},"as":"flights"}},"queryList":[],"dependencies":{}}',
              },
            ],
          },
        },
        {session_id}
      );

      const expectedAfterSecondCall: Malloy.CompileModelResponse = {
        model: {
          entries: [
            {
              kind: 'source',
              name: 'flights',
              schema: {
                fields: [
                  {
                    kind: 'dimension',
                    name: 'carrier',
                    type: {kind: 'string_type'},
                  },
                ],
              },
            },
          ],
          anonymous_queries: [],
        },
      };
      expect(resultSecondCall).toMatchObject(expectedAfterSecondCall);
    });
  });
});
