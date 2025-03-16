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
} from './malloy_types';

interface MomentIs {
  begin: string;
  end: string;
}

interface TranslatedExpr {
  sql: string;
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
        let begOp = '>=';
        let endOp = '<';
        let joinOp = 'AND';
        if (tc.not) {
          joinOp = 'OR';
          begOp = '<';
          endOp = '>=';
        }
        const m = this.moment(tc.in);
        return `${x} ${begOp} ${m.begin} ${joinOp} ${x} ${endOp} ${m.end}`;
      }
      case 'for':
      case 'in_last':
      case 'last':
      case 'next':
      case 'to':
        throw new Error('Missing temporal operator');
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

  private expandLiteral(tl: TemporalLiteral): TimeLiteralNode & TranslatedExpr {
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

  private nowExpr(): NowNode & TranslatedExpr {
    return {
      node: 'now',
      typeDef: {type: 'timestamp'},
      sql: this.d.sqlNowExpr(),
    };
  }

  private n(literal: string): NumberLiteralNode & TranslatedExpr {
    return {node: 'numberLiteral', literal, sql: literal};
  }

  private delta(
    from: Expr,
    op: '+' | '-',
    n: string,
    units: TemporalUnit
  ): TimeDeltaExpr & TranslatedExpr {
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

  private today(): TimeTruncExpr & TranslatedExpr {
    const nowTruncExpr: TimeTruncExpr = {
      node: 'trunc',
      e: this.nowExpr(),
      units: 'day',
    };
    return {...nowTruncExpr, sql: this.d.sqlTruncExpr({}, nowTruncExpr)};
  }

  private moment(m: Moment): MomentIs {
    switch (m.moment) {
      // mtoy todo moments which have no duration should have somethign in the interface?
      case 'now': {
        const now = this.nowExpr();
        return {begin: now.sql, end: now.sql};
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
        return {begin, end};
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
        const begin = beginExpr.sql;
        // Now the end is one unit after that .. either n-1 units ago or n+1 units from now
        if (m.moment === 'ago' && m.n === '1') {
          return {begin, end: nowTruncExpr.sql};
        }
        const oneDifferent = Number(m.n) + m.moment === 'ago' ? -1 : 1;
        const endExpr = {
          ...beginExpr,
          kids: {base: nowTrunc, delta: this.n(oneDifferent.toString())},
        };
        return {begin, end: this.d.sqlAlterTimeExpr(endExpr)};
      }
      case 'today': {
        const today = this.today();
        const tomorrow = this.delta(today, '+', '1', 'day');
        return {begin: today.sql, end: tomorrow.sql};
      }
      case 'yesterday': {
        const today = this.today();
        const yesterday = this.delta(today, '-', '1', 'day');
        return {begin: yesterday.sql, end: today.sql};
      }
      case 'tomorrow': {
        const today = this.today();
        const tomorrow = this.delta(today, '+', '1', 'day');
        const day_after_tomorrow = this.delta(today, '+', '2', 'day');
        return {begin: tomorrow.sql, end: day_after_tomorrow.sql};
      }
      case 'monday':
      case 'tuesday':
      case 'wednesday':
      case 'thursday':
      case 'friday':
      case 'saturday':
      case 'sunday':
      case 'this':
      case 'last':
      case 'next':
        throw new Error(`Temporal moment ${m.moment} not implemented`);
    }
  }
}
