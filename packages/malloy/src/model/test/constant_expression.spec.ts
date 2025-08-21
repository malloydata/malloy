import {DuckDBDialect} from '../../dialect';
import {constantExprToSQL} from '../constant_expression_compiler';
import type {Expr, Parameter} from '../malloy_types';

describe('Constant Expression Compiler', () => {
  const dialect = new DuckDBDialect();

  describe('Basic compilation', () => {
    test('compiles 1 + 1', () => {
      const expr: Expr = {
        node: '+',
        kids: {
          left: {node: 'numberLiteral', literal: '1'},
          right: {node: 'numberLiteral', literal: '1'},
        },
      };
      const result = constantExprToSQL(expr, dialect);
      expect(result).toHaveProperty('sql');
      expect(result.sql).toBeTruthy();
    });

    test('compiles a simple literal', () => {
      const expr: Expr = {node: 'numberLiteral', literal: '42'};
      const result = constantExprToSQL(expr, dialect);
      expect(result).toHaveProperty('sql');
      expect(result.sql).toBeTruthy();
    });

    test('compiles nested expressions', () => {
      // (1 + 2) * 3
      const expr: Expr = {
        node: '*',
        kids: {
          left: {
            node: '+',
            kids: {
              left: {node: 'numberLiteral', literal: '1'},
              right: {node: 'numberLiteral', literal: '2'},
            },
          },
          right: {node: 'numberLiteral', literal: '3'},
        },
      };
      const result = constantExprToSQL(expr, dialect);
      expect(result).toHaveProperty('sql');
      expect(result.sql).toBeTruthy();
    });
  });

  describe('Parameter substitution', () => {
    test('compiles 1 + ${one}', () => {
      const expr: Expr = {
        node: '+',
        kids: {
          left: {node: 'numberLiteral', literal: '1'},
          right: {node: 'parameter', path: ['one']},
        },
      };

      const parameters: Record<string, Parameter> = {
        one: {
          name: 'one',
          type: 'number',
          value: {node: 'numberLiteral', literal: '1'},
        },
      };

      const result = constantExprToSQL(expr, dialect, parameters);
      expect(result).toHaveProperty('sql');
      expect(result.sql).toBeTruthy();
      // The parameter should be substituted, so the SQL should contain two 1s
      expect(result.sql).toContain('1');
    });

    test('substitutes multiple parameters', () => {
      const expr: Expr = {
        node: '*',
        kids: {
          left: {node: 'parameter', path: ['a']},
          right: {node: 'parameter', path: ['b']},
        },
      };

      const parameters: Record<string, Parameter> = {
        a: {
          name: 'a',
          type: 'number',
          value: {node: 'numberLiteral', literal: '5'},
        },
        b: {
          name: 'b',
          type: 'number',
          value: {node: 'numberLiteral', literal: '10'},
        },
      };

      const result = constantExprToSQL(expr, dialect, parameters);
      expect(result).toHaveProperty('sql');
      expect(result.sql).toBeTruthy();
    });

    test('substitutes nested parameter expressions', () => {
      const expr: Expr = {node: 'parameter', path: ['nested']};

      const parameters: Record<string, Parameter> = {
        nested: {
          name: 'nested',
          type: 'number',
          value: {
            node: '+',
            kids: {
              left: {node: 'numberLiteral', literal: '10'},
              right: {node: 'numberLiteral', literal: '20'},
            },
          },
        },
      };

      const result = constantExprToSQL(expr, dialect, parameters);
      expect(result).toHaveProperty('sql');
      expect(result.sql).toBeTruthy();
    });
  });

  describe('Error handling', () => {
    test('throws error when parameter has no value', () => {
      const expr: Expr = {node: 'parameter', path: ['missing']};

      const parameters: Record<string, Parameter> = {
        missing: {
          name: 'missing',
          type: 'string',
          value: null,
        },
      };

      // Parameter errors from the original expression compiler are thrown, not returned
      expect(() => constantExprToSQL(expr, dialect, parameters)).toThrow(
        'no value for missing'
      );
    });

    test('throws error when parameter is not defined', () => {
      const expr: Expr = {node: 'parameter', path: ['undefined_param']};

      // Parameter errors from the original expression compiler are thrown, not returned
      expect(() => constantExprToSQL(expr, dialect, {})).toThrow();
    });

    test('returns error when trying to reference a field', () => {
      const expr: Expr = {node: 'field', path: ['someField']};
      const result = constantExprToSQL(expr, dialect);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Illegal reference');
      expect(result.error).toContain('someField');
    });

    test('returns error for field references in complex expressions', () => {
      const expr: Expr = {
        node: '+',
        kids: {
          left: {node: 'numberLiteral', literal: '1'},
          right: {node: 'field', path: ['myField']},
        },
      };
      const result = constantExprToSQL(expr, dialect);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Illegal reference');
      expect(result.error).toContain('myField');
    });
  });

  describe('Result structure', () => {
    test('successful compilation returns {sql: string}', () => {
      const expr: Expr = {node: 'null'};
      const result = constantExprToSQL(expr, dialect);

      expect(result).toHaveProperty('sql');
      expect(result).not.toHaveProperty('error');
      expect(typeof result.sql).toBe('string');
    });

    test('error case returns {error: string}', () => {
      const expr: Expr = {node: 'field', path: ['bad']};
      const result = constantExprToSQL(expr, dialect);

      expect(result).toHaveProperty('error');
      expect(result).not.toHaveProperty('sql');
      expect(typeof result.error).toBe('string');
    });
  });
});
