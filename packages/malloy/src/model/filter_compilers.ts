/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {StringClause} from '@malloydata/malloy-filter';
import {Dialect} from '../dialect';

function likeSafe(v: string) {
  return v.replace(/([_%])g/, '\\$1');
}

/*
 * These compilers from filter expression to SQL actually belong in malloy-filters but
 * that will require moving Dialect out to malloy-dialect to avoid a circular dependency
 * between the filter compilers and packages/malloy. That's why these are
 * defined in this slightly weird way. At some point the code here for
 * XXXXFilterCompiler.compile() will move to XXXFilterExpression.compile()
 */

export const FilterCompilers = {
  stringCompile(sc: StringClause, x: string, d: Dialect): string {
    switch (sc.operator) {
      case 'null':
        return sc.not ? `${x} IS NOT NULL` : `${x} IS NULL`;
      case 'empty':
        return sc.not ? `COALESCE(${x},'') != ''` : `COALESCE(${x},'') = ''`;
      case '=': {
        if (sc.values.length === 1) {
          const eq = sc.not ? '!=' : '=';
          const compare = `${x} ${eq} ${d.sqlLiteralString(sc.values[0])}`;
          return sc.not ? `(${compare} OR ${x} IS NULL)` : compare;
        }
        const eqList =
          '(' + sc.values.map(v => d.sqlLiteralString(v)).join(', ') + ')';
        return sc.not
          ? `(${x} NOT IN ${eqList} OR ${x} IS NULL)`
          : `${x} IN ${eqList}`;
      }
      case '()': {
        const wrapped =
          '(' + FilterCompilers.stringCompile(sc.expr, x, d) + ')';
        return sc.not ? `not ${wrapped}` : wrapped;
      }
      case 'contains': {
        const matches = sc.values.map(v => '%' + likeSafe(v) + '%');
        if (sc.not) {
          return matches.map(m => d.sqlLike('NOT LIKE', x, m)).join(' and ');
        }
        return matches.map(m => d.sqlLike('LIKE', x, m)).join(' or ');
      }
      case 'starts': {
        const matches = sc.values.map(v => likeSafe(v) + '%');
        if (sc.not) {
          return matches.map(m => d.sqlLike('NOT LIKE', x, m)).join(' and ');
        }
        return matches.map(m => d.sqlLike('LIKE', x, m)).join(' or ');
      }
      case 'ends': {
        const matches = sc.values.map(v => '%' + likeSafe(v));
        if (sc.not) {
          return matches.map(m => d.sqlLike('NOT LIKE', x, m)).join(' and ');
        }
        return matches.map(m => d.sqlLike('LIKE', x, m)).join(' or ');
      }
      case '~':
        if (sc.not) {
          return sc.escaped_values
            .map(m => d.sqlLike('NOT LIKE', x, m))
            .join(' and ');
        }
        return sc.escaped_values.map(m => d.sqlLike('LIKE', x, m)).join(' or ');
      case 'and': {
        const clauses = sc.members.map(c =>
          FilterCompilers.stringCompile(c, x, d)
        );
        return clauses.join(' and ');
      }
      case 'or': {
        const clauses = sc.members.map(c =>
          FilterCompilers.stringCompile(c, x, d)
        );
        return clauses.join(' or ');
      }
      case ',': {
        /*
         * Basic formula over all members
         * ALL INCLUDED THINGS OR TOGETHER AND ALL EXCLUDED THINGS ANDED TOGETHER
         */
        const includes: StringClause[] = [];
        const excludes: StringClause[] = [];
        let includeNull = false;
        let excludeNull = false;
        let includeEmpty = false;
        let excludeEmpty = false;
        for (const c of sc.members) {
          switch (c.operator) {
            case 'or':
            case 'and':
            case ',':
              includes.push(c);
              break;
            case 'null':
              if (c.not) {
                excludeNull = true;
              } else {
                includeNull = true;
              }
              break;
            case 'empty':
              if (c.not) {
                excludeEmpty = true;
                excludeNull = true;
              } else {
                includeEmpty = true;
                includeNull = true;
              }
              break;
            default:
              (c.not ? excludes : includes).push(c);
          }
        }
        if ((includeEmpty && excludeEmpty) || (includeNull && excludeNull)) {
          return 'false';
        }
        let includeSQL = '';
        if (includes.length > 0 || includeNull || includeEmpty) {
          excludeEmpty = false;
          excludeNull = false;
          const includeExprs = includes.map(inc =>
            FilterCompilers.stringCompile(inc, x, d)
          );
          if (includeEmpty) {
            includeExprs.push(`${x} = ''`);
          }
          if (includeNull) {
            includeExprs.push(`${x} IS NULL`);
          }
          includeSQL = includeExprs.join(' or ');
        }
        let excludeSQL = '';
        if (excludes.length > 0 || excludeEmpty || excludeNull) {
          const excludeExprs = excludes.map(inc =>
            FilterCompilers.stringCompile(inc, x, d)
          );
          if (excludeEmpty) {
            excludeExprs.push(`${x} != ''`);
          }
          if (excludeNull) {
            excludeExprs.push(`${x} IS NOT NULL`);
          }
          excludeSQL = excludeExprs.join(' and ');
        }
        if (includeSQL) {
          return excludeSQL !== ''
            ? includeSQL + ' and ' + excludeSQL
            : includeSQL;
        }
        return excludeSQL !== '' ? excludeSQL : 'true';
      }
    }
  },
};
