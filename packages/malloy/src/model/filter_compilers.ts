/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  BooleanClause,
  ClauseBase,
  NumberClause,
  StringClause,
  TemporalClause,
  isNumberClause,
  isStringClause,
  isTemporalClause,
  isBooleanClause,
  NumberRangeOperator,
} from '@malloydata/malloy-filter';
import {Dialect} from '../dialect';

function escapeForLike(v: string) {
  return v.replace(/([%_\\])/g, '\\$1');
}

function invertCompare(no: NumberRangeOperator): NumberRangeOperator {
  if (no === '>') return '<=';
  else if (no === '<') return '>=';
  else if (no === '>=') return '<';
  return '>';
}

function unlike(disLiked: string[], x: string) {
  const orNull = ` OR ${x} IS NULL`;
  if (disLiked.length === 1) {
    return `${disLiked[0]}${orNull}`;
  }
  return `(${disLiked.join(' AND ')})${orNull}`;
}

/*
 * These compilers from filter expression to SQL actually belong in malloy-filters but
 * that will require moving Dialect out to malloy-dialect to avoid a circular dependency
 * between the filter compilers and packages/malloy. That's why these are
 * defined in this slightly weird way. At some point the code here for
 * XXXXFilterCompiler.compile() will move to XXXFilterExpression.compile()
 */

export const FilterCompilers = {
  compile(t: string, c: ClauseBase, x: string, d: Dialect) {
    if (t === 'string' && isStringClause(c)) {
      return FilterCompilers.stringCompile(c, x, d);
    } else if (t === 'number' && isNumberClause(c)) {
      return FilterCompilers.numberCompile(c, x, d);
    } else if (t === 'boolean' && isBooleanClause(c)) {
      return FilterCompilers.booleanCompile(c, x, d);
    } else if ((t === 'date' || t === 'timestamp') && isTemporalClause(c)) {
      return FilterCompilers.temporalCompile(c, x, d);
    }
    throw new Error('INTERNAL ERROR: No filter compiler for ' + t);
  },
  numberCompile(nc: NumberClause, x: string, d: Dialect): string {
    switch (nc.operator) {
      case '!=':
      case '=': {
        const notEqual =
          (nc.operator === '=' && !nc.not) || (nc.operator === '!=' && nc.not);
        const optList = nc.values.map(
          v => `${x} ${notEqual ? '!=' : '='} ${v}`
        );
        if (notEqual) {
          if (optList.length > 1) {
            return `(${optList.join(' AND ')}) OR ${x} IS NULL`;
          }
          return `${optList[0]} OR ${x} IS NULL`;
        }
        return optList.join(notEqual ? ' AND ' : ' OR ');
      }
      case '>':
      case '<':
      case '>=':
      case '<=':
        return nc.values
          .map(v => `${x} ${nc.operator} ${v}`)
          .join(nc.not ? ' AND ' : ' OR ');
      case 'range': {
        let startOp = nc.startOperator;
        let endOp = nc.endOperator;
        if (nc.not) {
          startOp = invertCompare(startOp);
          endOp = invertCompare(endOp);
        }
        return `${x} ${startOp} ${nc.startValue} AND ${x} ${endOp} ${nc.endValue}`;
      }
      case 'null':
        return nc.not ? `${x} IS NOT NULL` : `${x} IS NULL`;
      case '()': {
        const wrapped =
          '(' + FilterCompilers.numberCompile(nc.expr, x, d) + ')';
        return nc.not ? `NOT ${wrapped}` : wrapped;
      }
      case 'and':
      case 'or':
        return nc.members
          .map(m => FilterCompilers.numberCompile(m, x, d))
          .join(` ${nc.operator.toUpperCase()}`);
    }
  },
  booleanCompile(bc: BooleanClause, x: string, _d: Dialect): string {
    switch (bc.operator) {
      case 'false':
        return `${x} = false`;
      case 'false_or_null':
        return `${x} IS NULL OR ${x} = false`;
      case 'null':
        return bc.not ? `${x} IS NOT NULL` : `${x} IS NULL`;
      case 'true':
        return x;
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  temporalCompile(tc: TemporalClause, x: string, d: Dialect): string {
    return 'false';
  },
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
        const matches = sc.values.map(v => '%' + escapeForLike(v) + '%');
        if (sc.not) {
          return unlike(
            matches.map(m => d.sqlLike('NOT LIKE', x, m)),
            x
          );
        }
        return matches.map(m => d.sqlLike('LIKE', x, m)).join(' OR ');
      }
      case 'starts': {
        const matches = sc.values.map(v => escapeForLike(v) + '%');
        if (sc.not) {
          return unlike(
            matches.map(m => d.sqlLike('NOT LIKE', x, m)),
            x
          );
        }
        return matches.map(m => d.sqlLike('LIKE', x, m)).join(' OR ');
      }
      case 'ends': {
        const matches = sc.values.map(v => '%' + escapeForLike(v));
        if (sc.not) {
          return unlike(
            matches.map(m => d.sqlLike('NOT LIKE', x, m)),
            x
          );
        }
        return matches.map(m => d.sqlLike('LIKE', x, m)).join(' OR ');
      }
      case '~':
        if (sc.not) {
          return unlike(
            sc.escaped_values.map(m => d.sqlLike('NOT LIKE', x, m)),
            x
          );
        }
        return sc.escaped_values.map(m => d.sqlLike('LIKE', x, m)).join(' OR ');
      case 'and': {
        const clauses = sc.members.map(c =>
          FilterCompilers.stringCompile(c, x, d)
        );
        return clauses.join(' AND ');
      }
      case 'or': {
        const clauses = sc.members.map(c =>
          FilterCompilers.stringCompile(c, x, d)
        );
        return clauses.join(' AND ');
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
          includeSQL = includeExprs.join(' OR ');
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
          excludeSQL = excludeExprs.join(' AND ');
        }
        if (includeSQL) {
          return excludeSQL !== ''
            ? `(${includeSQL}) AND (${excludeSQL})`
            : includeSQL;
        }
        return excludeSQL !== '' ? excludeSQL : 'true';
      }
    }
  },
};
