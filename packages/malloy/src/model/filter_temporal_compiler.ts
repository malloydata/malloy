/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Moment,
  TemporalClause,
  TemporalLiteral,
  TemporalUnit,
} from '@malloydata/malloy-filter';
import {Dialect} from '../dialect';
import {
  TimeLiteralNode,
  isTimestampUnit,
  TimeDeltaExpr,
  Expr,
  TimeTruncExpr,
  NowNode,
  NumberLiteralNode,
  mkTemporal,
  TimestampUnit,
  TimeExtractExpr,
} from './malloy_types';

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
    dialect: Dialect
  ) {
    this.d = dialect;
  }

  compile(tc: TemporalClause): string {
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

  private expandLiteral(tl: TemporalLiteral): Translated<TimeLiteralNode> {
    let literal = tl.literal;
    switch (tl.units) {
      case 'year':
        literal += '-01-01 00:00';
        break;
      case 'month':
        literal += '-01 00:00';
        break;
      case 'day':
        literal += ' 00:00';
        break;
      case 'hour':
        literal += ':00';
        break;
      case 'second':
        break;
      case 'minute':
        break;
      case 'week':
        literal = literal.slice(0, 10);
        break;
      case 'quarter': {
        const yyyy = literal.slice(0, 4);
        const q = literal.slice(6);
        if (q === '1') {
          literal = `${yyyy}-01-01`;
        } else if (q === '2') {
          literal = `${yyyy}-03-01`;
        } else if (q === '3') {
          literal = `${yyyy}-06-01`;
        }
        literal = `${yyyy}-09-01`;
      }
    }
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
    const nextUnit = this.delta(thisUnit, '+', '1', 'day');
    return {begin: thisUnit, end: nextUnit.sql};
  }

  private lastUnit(units: TimestampUnit): MomentIs {
    const thisUnit = this.nowDot(units);
    const lastUnit = this.delta(thisUnit, '-', '1', 'day');
    return {begin: lastUnit, end: thisUnit.sql};
  }

  private nextUnit(units: TimestampUnit): MomentIs {
    const thisUnit = this.nowDot(units);
    const nextUnit = this.delta(thisUnit, '+', '1', 'day');
    const next2Unit = this.delta(thisUnit, '+', '2', 'day');
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
      case 'literal': {
        // begins on the literal, ends on the literal + 1 unit
        // mtoy todo get the literal to timestamp code from the translator ...
        const beginLiteral = this.expandLiteral(m);
        const begin = beginLiteral.sql;
        let end = begin;
        if (m.units && isTimestampUnit(m.units)) {
          end = this.delta(beginLiteral, '+', '1', m.units).sql;
        }
        return {begin: beginLiteral, end};
      }
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
      // ------ mtoy todo implement (next ? last) weekday
      // daqy of week === 0-6
      /*
       * nextDow = (dow(today) + 7) % 7;
       * next = today + nextDow days;
       */
      case 'monday':
      case 'tuesday':
      case 'wednesday':
      case 'thursday':
      case 'friday':
      case 'saturday':
      case 'sunday': {
        const destDay = [
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sunday',
        ].indexOf(m.moment);
        const dow = this.dayofWeek(this.nowExpr());
        if (m.which === 'next') {
          const nForwards = this.mod7(`${destDay}-${dow.sql}+7`);
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
          return {begin, end: end.sql};
        }
        const nBack = this.mod7(`${dow.sql}-${destDay}+7`);
        const begin = this.delta(this.thisUnit('day').begin, '-', nBack, 'day');
        const end = this.delta(
          this.thisUnit('day').begin,
          '-',
          `${nBack}-1`,
          'day'
        );
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
