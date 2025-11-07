/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  BooleanFilter,
  FilterExpression,
  NumberFilter,
  StringFilter,
  NumberRangeOperator,
  Moment,
  TemporalFilter,
  TemporalLiteral,
  TemporalUnit,
} from '@malloydata/malloy-filter';
import {
  isNumberFilter,
  isStringFilter,
  isTemporalFilter,
  isBooleanFilter,
} from '@malloydata/malloy-filter';
import type {Dialect, QueryInfo} from '../dialect';
import type {
  TimeLiteralNode,
  TimeDeltaExpr,
  Expr,
  TimeTruncExpr,
  NowNode,
  NumberLiteralNode,
  TimestampUnit,
  TimeExtractExpr,
} from './malloy_types';
import {mkTemporal} from './malloy_types';
import {DateTime as LuxonDateTime} from 'luxon';

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
  const unlikeSQL =
    disLiked.length === 1 ? disLiked[0] : `(${disLiked.join(' AND ')})`;
  return `(${unlikeSQL} OR ${x} IS NULL)`;
}

/*
 * These compilers from filter expression to SQL actually belong in malloy-filters but
 * that will require moving Dialect out to malloy-dialect to avoid a circular dependency
 * between the filter compilers and packages/malloy. That's why these are
 * defined in this slightly weird way. At some point the code here for
 * XXXXFilterCompiler.compile() will move to XXXFilterExpression.compile()
 */

export const FilterCompilers = {
  compile(
    t: string,
    c: FilterExpression | null,
    x: string,
    d: Dialect,
    qi: QueryInfo = {}
  ) {
    if (c === null) {
      return 'true';
    }
    if (t === 'string' && isStringFilter(c)) {
      return FilterCompilers.stringCompile(c, x, d);
    } else if (t === 'number' && isNumberFilter(c)) {
      return FilterCompilers.numberCompile(c, x, d);
    } else if (t === 'boolean' && isBooleanFilter(c)) {
      return FilterCompilers.booleanCompile(c, x, d);
    } else if ((t === 'date' || t === 'timestamp') && isTemporalFilter(c)) {
      return FilterCompilers.temporalCompile(c, x, d, t, qi);
    }
    throw new Error('INTERNAL ERROR: No filter compiler for ' + t);
  },
  numberCompile(nc: NumberFilter, x: string, d: Dialect): string {
    switch (nc.operator) {
      case '!=':
      case '=': {
        const notEqual =
          (nc.operator === '=' && nc.not) || (nc.operator === '!=' && !nc.not);
        const optList = nc.values.join(', ');
        if (nc.values.length === 1) {
          if (notEqual) return `(${x} != ${optList} OR ${x} IS NULL)`;
          return `${x} = ${optList}`;
        }
        if (notEqual) return `(${x} NOT IN (${optList}) OR ${x} IS NULL)`;
        return `${x} IN (${optList})`;
      }
      case '>':
      case '<':
      case '>=':
      case '<=': {
        const op = nc.not ? invertCompare(nc.operator) : nc.operator;
        return nc.values
          .map(v => `${x} ${op} ${v}`)
          .join(nc.not ? ' AND ' : ' OR ');
      }
      case 'range': {
        let startOp = nc.startOperator;
        let endOp = nc.endOperator;
        let plus = ' AND ';
        if (nc.not) {
          startOp = invertCompare(startOp);
          endOp = invertCompare(endOp);
          plus = ' OR ';
        }
        return `${x} ${startOp} ${nc.startValue} ${plus} ${x} ${endOp} ${nc.endValue}`;
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
          .join(` ${nc.operator.toUpperCase()} `);
    }
  },
  booleanCompile(bc: BooleanFilter, x: string, d: Dialect): string {
    const px = `(${x})`;
    /*
     * We have the following truth table for boolean filters.
     * The default malloy operations treat null as false. The '='
     * variants exist for cases where that is not desired.
     *
     * filter expression | x=true | x=false | x=null
     * true              |   T    |   F     |   F
     * not true          |   F    |   T     |   T
     * =true             |   T    |   F     |   NULL
     * not =true         |   F    |   T     |   NULL
     * false             |   F    |   T     |   T
     * not false         |   T    |   F     |   F
     * =false            |   F    |   T     |   NULL
     * not =false        |   T    |   F     |   NULL
     */

    if (bc.operator === '=true') {
      return bc.not ? `NOT ${px}` : x;
    } else if (bc.operator === '=false') {
      return bc.not ? x : `NOT ${px}`;
    } else if (bc.operator === 'null') {
      return bc.not ? `${px} IS NOT NULL` : `${px} IS NULL`;
    }

    // For some databases checking NULL combined with a boolean check
    // is faster than a COALESCE, for now, just detect if the expression
    // is just a column reference, and if so, don't use COALECSE.
    const quoteChar = d.sqlMaybeQuoteIdentifier('select')[0];
    const isColumn = x.match(`^[()${quoteChar}\\w.]+$`);

    if (isColumn) {
      if (bc.operator === 'true') {
        return bc.not
          ? `${px} IS NULL OR ${px} = false`
          : `${px} IS NOT NULL AND ${px}`;
      }
      return bc.not
        ? `${px} IS NOT NULL AND ${px}` // not false: exclude null
        : `${px} IS NULL OR ${px} = false`; // false: include null
    }
    if (bc.operator === 'true') {
      return bc.not ? `NOT COALESCE(${x}, false)` : `COALESCE(${x}, false)`;
    }
    // else bc.operator === 'false'
    return bc.not ? `COALESCE(${x}, false)` : `NOT COALESCE(${x}, false)`;
  },
  stringCompile(sc: StringFilter, x: string, d: Dialect): string {
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
        return clauses.join(' OR ');
      }
      case ',': {
        /*
         * Basic formula over all members
         *    (ALL INCLUDED THINGS OR TOGETHER)
         * AND
         *    (ALL EXCLUDED THINGS ANDED TOGETHER)
         */
        const includes: StringFilter[] = [];
        const excludes: StringFilter[] = [];
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
  // mtoy todo figure out what to do about dates
  temporalCompile(
    tc: TemporalFilter,
    x: string,
    d: Dialect,
    t: 'date' | 'timestamp',
    qi: QueryInfo = {}
  ): string {
    const c = new TemporalFilterCompiler(x, d, t, qi);
    return c.compile(tc);
  },
};

/*
 * The compilation from Expr to SQL string walks the expression tree, and I thought it was cute
 * to walk the children, stash each child compilation in each child node in ".sql" rather
 * that making every node have a recursive call. Every dialect function expects, if it is passed
 * a node, that the node is already translated.
 *
 * Now that means I have to also do that, so that if I make an Expr to hand to a dialect function,
 * any nodes it has inside it need to be already translated. All the private functions inside
 * TemporalFilterCompiler deal with this kind of Expr
 */
type Translated<T extends Expr> = T & {
  sql: string;
};

interface MomentIs {
  begin: Translated<Expr>;
  end: string;
  momentary?: true;
}

const fYear = 'yyyy';
const fMonth = `${fYear}-LL`;
const fDay = `${fMonth}-dd`;
const fHour = `${fDay} HH`;
const fMinute = `${fHour}:mm`;
const fTimestamp = `${fMinute}:ss`;

/**
 * I felt like there was enough "helpful functions needed to make everything
 * work, all of which need to know the dialect", to justify making a class
 * for this. Maybe this should just be a set of functions which take
 * a dialect as an argument?
 */
export class TemporalFilterCompiler {
  readonly d: Dialect;
  readonly qi: QueryInfo;

  constructor(
    readonly expr: string,
    dialect: Dialect,
    readonly timetype: 'timestamp' | 'date' = 'timestamp',
    queryInfo: QueryInfo = {}
  ) {
    this.d = dialect;
    this.qi = queryInfo;
  }

  time(timeSQL: string): string {
    if (this.timetype === 'timestamp') {
      return timeSQL;
    }
    return this.d.sqlCast(
      {},
      {
        node: 'cast',
        e: {
          node: 'genericSQLExpr',
          src: ['', timeSQL],
          kids: {args: []},
          sql: timeSQL,
        },
        srcType: {type: 'timestamp'},
        dstType: {type: 'date'},
        safe: false,
      }
    );
  }

  compile(tc: TemporalFilter): string {
    const x = this.expr;
    switch (tc.operator) {
      case 'after':
        return `${x} ${tc.not ? '<' : '>='} ${this.time(
          this.moment(tc.after).end
        )}`;
      case 'before':
        return `${x} ${tc.not ? '>=' : '<'} ${this.time(
          this.moment(tc.before).begin.sql
        )}`;
      case 'in': {
        const m = this.moment(tc.in);
        if (m.begin.sql === m.end) {
          return tc.not
            ? `(${x} != ${this.time(m.end)} OR ${x} IS NULL)`
            : `${x} = ${this.time(m.end)}`;
        }
        return this.isIn(tc.not, m.begin.sql, m.end);
      }
      case 'for': {
        const start = this.moment(tc.begin);
        const end = this.delta(start.begin, '+', tc.n, tc.units);
        return this.isIn(tc.not, start.begin.sql, end.sql);
      }
      case 'in_last': {
        // last N units means "N - 1 UNITS AGO FOR N UNITS"
        const back = Number(tc.n) - 1;
        const thisUnit = this.nowDot(tc.units);
        const start =
          back > 0
            ? this.delta(thisUnit, '-', back.toString(), tc.units)
            : thisUnit;
        const end = this.delta(thisUnit, '+', '1', tc.units);
        return this.isIn(tc.not, start.sql, end.sql);
      }
      case 'to': {
        const firstMoment = this.moment(tc.fromMoment);
        const lastMoment = this.moment(tc.toMoment);
        return this.isIn(tc.not, firstMoment.begin.sql, lastMoment.begin.sql);
      }
      case 'last': {
        const thisUnit = this.nowDot(tc.units);
        const start = this.delta(thisUnit, '-', tc.n, tc.units);
        return this.isIn(tc.not, start.sql, thisUnit.sql);
      }
      case 'next': {
        const thisUnit = this.nowDot(tc.units);
        const start = this.delta(thisUnit, '+', '1', tc.units);
        const end = this.delta(
          thisUnit,
          '+',
          (Number(tc.n) + 1).toString(),
          tc.units
        );
        return this.isIn(tc.not, start.sql, end.sql);
      }
      case 'null':
        return tc.not ? `${x} IS NOT NULL` : `${x} IS NULL`;
      case '()': {
        const wrapped = '(' + this.compile(tc.expr) + ')';
        return tc.not ? `NOT ${wrapped}` : wrapped;
      }
      case 'and':
      case 'or':
        return tc.members
          .map(m => this.compile(m))
          .join(` ${tc.operator.toUpperCase()} `);
    }
  }

  private expandLiteral(tl: TemporalLiteral): MomentIs {
    let literal = tl.literal;
    switch (tl.units) {
      case 'year': {
        const y = LuxonDateTime.fromFormat(literal, fYear);
        const begin = this.literalNode(y.toFormat(fTimestamp));
        const next = y.plus({year: 1});
        return {begin, end: this.literalNode(next.toFormat(fTimestamp)).sql};
      }
      case 'month': {
        const yyyymm = LuxonDateTime.fromFormat(literal, fMonth);
        const begin = this.literalNode(yyyymm.toFormat(fTimestamp));
        const next = yyyymm.plus({month: 1});
        return {begin, end: this.literalNode(next.toFormat(fTimestamp)).sql};
      }
      case 'day': {
        const yyyymmdd = LuxonDateTime.fromFormat(literal, fDay);
        const begin = this.literalNode(yyyymmdd.toFormat(fTimestamp));
        const next = yyyymmdd.plus({day: 1});
        return {begin, end: this.literalNode(next.toFormat(fTimestamp)).sql};
      }
      case 'hour': {
        const ymdh = LuxonDateTime.fromFormat(literal, fHour);
        const begin = this.literalNode(ymdh.toFormat(fTimestamp));
        const next = ymdh.plus({hour: 1});
        return {begin, end: this.literalNode(next.toFormat(fTimestamp)).sql};
      }
      case 'minute': {
        const ymdhm = LuxonDateTime.fromFormat(literal, fMinute);
        const begin = this.literalNode(ymdhm.toFormat(fTimestamp));
        const next = ymdhm.plus({minute: 1});
        return {begin, end: this.literalNode(next.toFormat(fTimestamp)).sql};
      }
      case 'week': {
        const a = LuxonDateTime.fromFormat(literal.slice(0, 10), fDay);
        // Luxon uses monday weeks, so look for the Monday week which contains
        // the day after, which for all days except Sunday is the same as
        // the sunday week, and on Sunday it is this monday week instead of
        // last monday week.
        const mondayWeek = a.plus({day: 1}).startOf('week');
        // Now back that up by one day and we have the Sunday week
        const ymd_wk = mondayWeek.minus({day: 1});
        const begin = this.literalNode(ymd_wk.toFormat(fTimestamp));
        const next = ymd_wk.plus({days: 7});
        return {begin, end: this.literalNode(next.toFormat(fTimestamp)).sql};
      }
      case 'quarter': {
        const yyyy = literal.slice(0, 4);
        const q = literal.slice(6);
        if (q === '1') {
          literal = `${yyyy}-01-01 00:00:00`;
        } else if (q === '2') {
          literal = `${yyyy}-03-01 00:00:00`;
        } else if (q === '3') {
          literal = `${yyyy}-06-01 00:00:00`;
        } else {
          literal = `${yyyy}-09-01 00:00:00`;
        }
        const begin = this.literalNode(literal);
        const ymd_q = LuxonDateTime.fromFormat(literal, fTimestamp);
        const next = ymd_q.plus({months: 3});
        return {begin, end: this.literalNode(next.toFormat(fTimestamp)).sql};
      }
      case undefined:
      case 'second': {
        const begin = this.literalNode(literal);
        return {begin, end: begin.sql};
      }
    }
  }

  private literalNode(literal: string): Translated<TimeLiteralNode> {
    const literalNode: TimeLiteralNode = {
      node: 'timeLiteral',
      typeDef: {type: 'timestamp'},
      literal,
    };
    if (this.qi.queryTimezone) {
      literalNode.timezone = this.qi.queryTimezone;
    }
    return {...literalNode, sql: this.d.sqlLiteralTime(this.qi, literalNode)};
  }

  private nowExpr(): Translated<NowNode> {
    return {
      node: 'now',
      typeDef: {type: 'timestamp'},
      sql: this.d.sqlNowExpr(),
    };
  }

  private n(literal: string): Translated<NumberLiteralNode> {
    return {node: 'numberLiteral', literal, sql: literal};
  }

  private delta(
    from: Expr,
    op: '+' | '-',
    n: string,
    units: TemporalUnit
  ): Translated<TimeDeltaExpr> {
    const ret: TimeDeltaExpr = {
      node: 'delta',
      op,
      units,
      kids: {
        base: mkTemporal(from, 'timestamp'),
        delta: this.n(n),
      },
    };
    return {...ret, sql: this.d.sqlAlterTimeExpr(ret)};
  }

  private dayofWeek(e: Expr): Translated<TimeExtractExpr> {
    const t: TimeExtractExpr = {
      node: 'extract',
      e: mkTemporal(e, 'timestamp'),
      units: 'day_of_week',
    };
    return {...t, sql: this.d.sqlTimeExtractExpr(this.qi, t)};
  }

  private nowDot(units: TimestampUnit): Translated<TimeTruncExpr> {
    const nowTruncExpr: TimeTruncExpr = {
      node: 'trunc',
      e: this.nowExpr(),
      units,
    };
    return {...nowTruncExpr, sql: this.d.sqlTruncExpr(this.qi, nowTruncExpr)};
  }

  private thisUnit(units: TimestampUnit): MomentIs {
    const thisUnit = this.nowDot(units);
    const nextUnit = this.delta(thisUnit, '+', '1', units);
    return {begin: thisUnit, end: nextUnit.sql};
  }

  private lastUnit(units: TimestampUnit): MomentIs {
    const thisUnit = this.nowDot(units);
    const lastUnit = this.delta(thisUnit, '-', '1', units);
    return {begin: lastUnit, end: thisUnit.sql};
  }

  private nextUnit(units: TimestampUnit): MomentIs {
    const thisUnit = this.nowDot(units);
    const nextUnit = this.delta(thisUnit, '+', '1', units);
    const next2Unit = this.delta(thisUnit, '+', '2', units);
    return {begin: nextUnit, end: next2Unit.sql};
  }

  mod7(n: string): string {
    return this.d.hasModOperator ? `(${n})%7` : `MOD(${n},7)`;
  }

  private moment(m: Moment): MomentIs {
    switch (m.moment) {
      case 'now': {
        const now = this.nowExpr();
        return {begin: now, end: now.sql};
      }
      case 'literal':
        return this.expandLiteral(m);
      case 'ago':
      case 'from_now': {
        const nowTruncExpr = this.nowDot(m.units);
        const nowTrunc = mkTemporal(nowTruncExpr, 'timestamp');
        const beginExpr = this.delta(
          nowTrunc,
          m.moment === 'ago' ? '-' : '+',
          m.n,
          m.units
        );
        // Now the end is one unit after that .. either n-1 units ago or n+1 units from now
        if (m.moment === 'ago' && m.n === '1') {
          return {begin: beginExpr, end: nowTruncExpr.sql};
        }
        const oneDifferent = Number(m.n) + (m.moment === 'ago' ? -1 : 1);
        const endExpr = {
          ...beginExpr,
          kids: {base: nowTrunc, delta: this.n(oneDifferent.toString())},
        };
        return {begin: beginExpr, end: this.d.sqlAlterTimeExpr(endExpr)};
      }
      case 'today':
        return this.thisUnit('day');
      case 'yesterday':
        return this.lastUnit('day');
      case 'tomorrow':
        return this.nextUnit('day');
      case 'this':
        return this.thisUnit(m.units);
      case 'last':
        return this.lastUnit(m.units);
      case 'next':
        return this.nextUnit(m.units);
      case 'sunday':
        return this.weekdayMoment(1, m.which);
      case 'monday':
        return this.weekdayMoment(2, m.which);
      case 'tuesday':
        return this.weekdayMoment(3, m.which);
      case 'wednesday':
        return this.weekdayMoment(4, m.which);
      case 'thursday':
        return this.weekdayMoment(5, m.which);
      case 'friday':
        return this.weekdayMoment(6, m.which);
      case 'saturday':
        return this.weekdayMoment(7, m.which);
    }
  }

  private isIn(notIn: boolean | undefined, begin: string, end: string) {
    let begOp = '>=';
    let endOp = '<';
    let joinOp = 'AND';
    if (notIn) {
      joinOp = 'OR';
      begOp = '<';
      endOp = '>=';
    }
    begin = this.time(begin);
    end = this.time(end);
    return `${this.expr} ${begOp} ${begin} ${joinOp} ${this.expr} ${endOp} ${end}`;
  }

  private weekdayMoment(
    destDay: number,
    which: 'last' | 'next' | undefined
  ): MomentIs {
    const direction = which || 'last';
    const dow = this.dayofWeek(this.nowExpr());
    const todayBegin = this.thisUnit('day').begin;

    // destDay comes in as 1-7 (Malloy format), convert to 0-6
    const destDayZeroBased = destDay - 1;
    // dow is 1-7, convert to 0-6 for the arithmetic
    const dowZeroBased = `(${dow.sql}-1)`;

    let beginOffset: string;
    let endOffset: string;

    // "dayname" and "last dayname" both refer to the most recent,
    // already complete day of that name. So if today is Sunday,
    // "next sunday" is "today", and "last sunday" is 7 days ago.
    if (direction === 'next') {
      // Days forward: ((destDay - currentDay + 6) % 7) + 1
      beginOffset = `${this.mod7(`${destDayZeroBased}-${dowZeroBased}+6`)}+1`;
      endOffset = `${this.mod7(`${destDayZeroBased}-${dowZeroBased}+6`)}+2`;
    } else {
      // Days back: ((currentDay - destDay + 6) % 7) + 1
      beginOffset = `${this.mod7(`${dowZeroBased}-${destDayZeroBased}+6`)}+1`;
      // End offset is one day less (closer to today)
      endOffset = `${this.mod7(`${dowZeroBased}-${destDayZeroBased}+6`)}`;
    }

    const begin = this.delta(
      todayBegin,
      direction === 'next' ? '+' : '-',
      beginOffset,
      'day'
    );
    const end = this.delta(
      todayBegin,
      direction === 'next' ? '+' : '-',
      endOffset,
      'day'
    );

    return {begin, end: end.sql};
  }
}
