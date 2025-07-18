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

import type {
  Expr,
  GenericSQLExpr,
  ModelDef,
  Query,
} from '../../../model/malloy_types';

import {MalloyElement} from '../types/malloy-element';
import {SourceQueryElement} from '../source-query-elements/source-query-element';
import type {ParameterSpace} from '../field-space/parameter-space';
import {SQReference} from '../source-query-elements/sq-reference';
import {FieldName} from '../types/field-space';
import {SpaceParam} from '../types/space-param';
import {QueryModel} from '../../../model';

type SQLStringSegment = string | SourceQueryElement;
export class SQLString extends MalloyElement {
  elementType = 'sqlString';
  elements: SQLStringSegment[] = [];
  containsQueries = false;

  complete() {
    this.has({
      queries: this.elements.filter(isQuery),
    });
  }

  push(el: string | MalloyElement): void {
    if (typeof el === 'string') {
      if (el.length > 0) {
        this.elements.push(el);
      }
    } else if (el instanceof SourceQueryElement) {
      this.elements.push(el);
      this.containsQueries = true;
      el.parent = this;
    } else {
      el.logError(
        'invalid-sql-source-interpolation',
        'This element is not legal inside an SQL string'
      );
    }
  }

  sqlPhrases(
    parameterSpace: ParameterSpace | undefined,
    partialModel: ModelDef | undefined
  ): {template: GenericSQLExpr; schema: GenericSQLExpr} {
    let queryModel: QueryModel | undefined = undefined;
    const template: GenericSQLExpr = {
      node: 'genericSQLExpr',
      kids: {args: []},
      src: [],
    };
    const schema: GenericSQLExpr = {
      node: 'genericSQLExpr',
      kids: {args: []},
      src: [],
    };
    let lastWasString = false;
    function addSQL(sql: string) {
      const prev = lastWasString ? template.src.pop() : '';
      template.src.push(prev + sql);
      schema.src.push(prev + sql);
      lastWasString = true;
    }
    function addParameter(name: string, defaultValue: Expr) {
      if (!lastWasString) {
        template.src.push('');
        schema.src.push('');
      }
      schema.kids.args.push(defaultValue);
      template.kids.args.push({node: 'parameter', path: [name]});
      lastWasString = false;
    }
    for (const el of this.elements) {
      if (typeof el === 'string') {
        addSQL(el);
      } else {
        // TODO modify the AST/parser to allow "general expressions" that are either SQExpressions or field expressions...
        /*
          interpolate
            : parened_reference
            | fExpr
            | sqExpr

          parened_reference
            : reference
            | OPAREN parened_reference CPAREN;
        */
        if (parameterSpace && el instanceof SQReference) {
          const paramName = el.ref.refString;
          const fn = new FieldName(paramName);
          this.has({fn});
          const lookup = parameterSpace.lookup([fn]);
          if (lookup.found) {
            if (lookup.found instanceof SpaceParam) {
              const defaultValue = lookup.found.parameter().value;
              if (defaultValue === null) {
                el.logError(
                  'parameter-default-required-for-sql-source',
                  `Parameter ${paramName} must have a default value because it is used in a SQL source; the default value is needed for schema resolution`
                );
              } else {
                addParameter(paramName, defaultValue);
              }
            }
            continue;
          }
        }
        const parenAlready =
          template.src[template.src.length - 1].match(/\(\s*$/) !== null;
        const queryObject = el.getQuery();
        if (queryObject) {
          const query = queryObject.query();
          const compiled = compileQueryToSql(query, partialModel, queryModel);
          queryModel ??= compiled.queryModel;
          const sql = parenAlready ? compiled.sql : `(${compiled.sql})`;
          addSQL(sql);
        } else {
          el.sqLog('failed-to-expand-sql-source', 'Cannot expand into a query');
        }
      }
    }
    return {template, schema};
  }
}

function compileQueryToSql(
  query: Query,
  partialModel: ModelDef | undefined,
  queryModel: QueryModel | undefined
) {
  if (!queryModel) {
    if (!partialModel) {
      throw new Error(
        'Internal error: Partial model missing when compiling SQL block'
      );
    }
    queryModel = new QueryModel(partialModel);
  }
  const sql = queryModel.compileQuery(
    query,
    {
      defaultRowLimit: undefined,
    },
    false
  ).sql;
  return {sql, queryModel};
}

function isQuery(x: SQLStringSegment): x is SourceQueryElement {
  return x instanceof SourceQueryElement;
}
