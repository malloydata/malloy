/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {FilterLog, isStringClause, StringClause} from './clause_types';
import * as nearley from 'nearley';
import fstring_grammar from './lib/fexpr_string_parser';
import {escape} from './clause_utils';

interface StringParseResult {
  parsed: StringClause | null;
  log: FilterLog[];
}

// This could be mistake, I am replacing the hand coded lexer and parsers
// which previously existed with nearley/moo -- As the language is still
// in flux, it is much easier for me to maintain the code if the parser
// is not hand coded. Full apologies to the original author of the hand
// coded parsers.
export const StringFilterExpression = {
  parse(src: string): StringParseResult {
    const fstring_parser = new nearley.Parser(
      nearley.Grammar.fromCompiled(fstring_grammar)
    );
    fstring_parser.feed(src);
    const results = fstring_parser.finish();
    const expr = results[0];
    if (isStringClause(expr)) {
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
  unparse(sc: StringClause): string {
    switch (sc.operator) {
      case '=':
        if (sc.not) {
          return sc.values.map(s => '-' + escape(s)).join(', ');
        }
        return sc.values.map(s => escape(s)).join(', ');
      case '~':
        if (sc.not) {
          return sc.escaped_values.map(s => '-' + s).join(', ');
        }
        return sc.escaped_values.join(', ');
      case 'starts':
        if (sc.not) {
          return sc.values.map(s => '-' + escape(s) + '%').join(', ');
        }
        return sc.values.map(s => escape(s) + '%').join(', ');
      case 'ends':
        if (sc.not) {
          return sc.values.map(s => '-%' + escape(s)).join(', ');
        }
        return sc.values.map(s => '%' + escape(s)).join(', ');
      case 'contains':
        if (sc.not) {
          return sc.values.map(s => '-%' + escape(s) + '%').join(', ');
        }
        return sc.values.map(s => '%' + escape(s) + '%').join(', ');
      case 'or':
        return sc.members
          .map(or => StringFilterExpression.unparse(or))
          .join(' | ');
      case 'and':
        return sc.members
          .map(or => StringFilterExpression.unparse(or))
          .join('; ');
      case ',':
        return sc.members
          .map(or => StringFilterExpression.unparse(or))
          .join(', ');
      case '()': {
        const expr = '(' + StringFilterExpression.unparse(sc.expr) + ')';
        return sc.not ? '-' + expr : expr;
      }
      case 'null':
        return sc.not ? '-null' : 'null';
      case 'empty':
        return sc.not ? '-empty' : 'empty';
    }
  },
};
