/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  FilterParserReponse,
  isTemporalClause,
  Moment,
  TemporalClause,
  Duration,
} from './filter_clause';
import ftemporal_grammar from './lib/ftemporal_parser';
import * as nearley from 'nearley';

export const TemporalFilterExpression = {
  parse(src: string): FilterParserReponse<TemporalClause> {
    const ftemporal_parser = new nearley.Parser(
      nearley.Grammar.fromCompiled(ftemporal_grammar)
    );
    ftemporal_parser.feed(src);
    const results = ftemporal_parser.finish();
    const expr = results[0];
    if (isTemporalClause(expr)) {
      return {parsed: expr, log: []};
    }
    // mtoy todo catch parse errors and reflect the error position at least
    return {
      parsed: null,
      log: [
        {
          message: 'Parse did not return a legal expression',
          startIndex: 0,
          endIndex: src.length - 1,
          severity: 'error',
        },
      ],
    };
  },
  unparse(tc: TemporalClause): string {
    switch (tc.operator) {
      case 'null':
        return notStr(tc, 'null');
      case 'in': {
        return notStr(tc, momentToStr(tc.in));
      }
      case '()':
        return '(' + TemporalFilterExpression.unparse(tc.expr) + ')';
      case 'in_last':
        return notStr(tc, durStr(tc));
      case 'last':
      case 'next':
        return notStr(tc, `${tc.operator} ${durStr(tc)}`);
      case 'before':
        return notStr(tc, `before ${momentToStr(tc.before)}`);
      case 'after':
        return notStr(tc, `after ${momentToStr(tc.after)}`);
      case 'to':
        return notStr(
          tc,
          `${momentToStr(tc.fromMoment)} to ${momentToStr(tc.toMoment)}`
        );
      case 'for':
        return notStr(tc, `${momentToStr(tc.begin)} for ${durStr(tc)}`);
      case 'or':
        return tc.members
          .map(or => TemporalFilterExpression.unparse(or))
          .join(' or ');
      case 'and':
        return tc.members
          .map(and => TemporalFilterExpression.unparse(and))
          .join(' and ');
      case ',':
        return tc.members
          .map(comma => TemporalFilterExpression.unparse(comma))
          .join(', ');
    }
  },
};

function notStr(tc: TemporalClause, s: string): string {
  if ('not' in tc && tc.not) {
    return 'not ' + s;
  }
  return s;
}

function durStr(d: Duration) {
  return d.n === '1' ? `1 ${d.units}` : `${d.n} ${d.units}s`;
}

function momentToStr(m: Moment): string {
  switch (m.moment) {
    case 'literal':
      return m.literal;
    case 'now':
    case 'today':
    case 'yesterday':
    case 'tomorrow':
      return m.moment;
    case 'monday':
    case 'tuesday':
    case 'wednesday':
    case 'thursday':
    case 'friday':
    case 'saturday':
    case 'sunday':
      return m.which === 'next' ? 'next ' + m.moment : m.moment;
    case 'this':
    case 'next':
    case 'last':
      return `${m.moment} ${m.units}`;
    case 'ago':
      return `${durStr(m)} ago`;
    case 'from_now':
      return `${durStr(m)} from now`;
  }
}
