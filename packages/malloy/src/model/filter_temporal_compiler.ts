/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  Moment,
  TemporalFilter,
  TemporalLiteral,
  TemporalUnit,
} from '@malloydata/malloy-filter';
import type {Dialect} from '../dialect';
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

  constructor(
    readonly expr: string,
    dialect: Dialect,
    readonly timetype: 'timestamp' | 'date' = 'timestamp'
  ) {
    this.d = dialect;
  }

  compile(tc: TemporalFilter): string {
    const x = this.expr;
    switch (tc.operator) {
      case 'after':
        return `${x} ${tc.not ? '<' : '>='} ${this.moment(tc.after).end}`;
      case 'before':
        return `${x} ${tc.not ? '>=' : '<'} ${this.moment(tc.before).begin}`;
      case 'in': {
        // mtoy todo in now
        const m = this.moment(tc.in);
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
        return this.isIn(tc.not, firstMoment.begin.sql, lastMoment.end);
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
      case 'second':
        return {begin: this.literalNode(literal), end: literal};
    }
  }

  private literalNode(literal: string): Translated<TimeLiteralNode> {
    const literalNode: TimeLiteralNode = {
      node: 'timeLiteral',
      typeDef: {type: 'timestamp'},
      literal,
    };
    return {...literalNode, sql: this.d.sqlLiteralTime({}, literalNode)};
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
    return {...t, sql: this.d.sqlTimeExtractExpr({}, t)};
  }

  private nowDot(units: TimestampUnit): Translated<TimeTruncExpr> {
    const nowTruncExpr: TimeTruncExpr = {
      node: 'trunc',
      e: this.nowExpr(),
      units,
    };
    return {...nowTruncExpr, sql: this.d.sqlTruncExpr({}, nowTruncExpr)};
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
      // mtoy todo moments which have no duration should have somethign in the interface?
      case 'now': {
        const now = this.nowExpr();
        return {begin: now, end: now.sql};
      }
      case 'literal':
        return this.expandLiteral(m);
      case 'ago':
      case 'from_now': {
        // mtoy todo just pretending all units work, they don't
        const nowTruncExpr: TimeTruncExpr = {
          node: 'trunc',
          e: this.nowExpr(),
          units: m.units,
        };
        nowTruncExpr.sql = this.d.sqlTruncExpr({}, nowTruncExpr);
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
        const oneDifferent = Number(m.n) + m.moment === 'ago' ? -1 : 1;
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
      case 'monday':
      case 'tuesday':
      case 'wednesday':
      case 'thursday':
      case 'friday':
      case 'saturday':
      case 'sunday': {
        const destDay = [
          'sunday',
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
        ].indexOf(m.moment);
        const dow = this.dayofWeek(this.nowExpr()).sql;
        if (m.which === 'next') {
          const nForwards = `${this.mod7(`${destDay}-(${dow}-1)+6`)}+1`;
          const begin = this.delta(
            this.thisUnit('day').begin,
            '+',
            nForwards,
            'day'
          );
          const end = this.delta(
            this.thisUnit('day').begin,
            '+',
            `${nForwards}+1`,
            'day'
          );
          // console.log(
          //   `SELECT ${
          //     this.nowExpr().sql
          //   } as now,\n  ${destDay} as destDay,\n  ${dow} as dow,\n  ${nForwards} as nForwards,\n  ${
          //     begin.sql
          //   } as begin,\n   ${end.sql} as end`
          // );
          return {begin, end: end.sql};
        }
        // dacks back = mod((daw0 - dst) + 6, 7) + 1;
        // dacks back = mod(((daw - 1) - dst) + 6, 7) + 1;
        // dacks back = mod(((daw) - dst) + 7, 7) + 1;
        const nBack = `${this.mod7(`(${dow}-1)-${destDay}+6`)}+1`;
        const begin = this.delta(this.thisUnit('day').begin, '-', nBack, 'day');
        const end = this.delta(
          this.thisUnit('day').begin,
          '-',
          `(${nBack})-1`,
          'day'
        );
        // console.log(
        //   `SELECT ${
        //     this.nowExpr().sql
        //   } as now,\n  ${destDay} as destDay,\n  ${dow} as dow,\n  ${nBack} as nBack,\n  ${
        //     begin.sql
        //   } as begin,\n   ${end.sql} as end`
        // );
        return {begin, end: end.sql};
      }
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
    return `${this.expr} ${begOp} ${begin} ${joinOp} ${this.expr} ${endOp} ${end}`;
  }
}
