/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  FilterParserReponse,
  isTemporalClause,
  TemporalClause,
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
    return 'UNPARSE ERROR: ' + JSON.stringify(tc, null, 2);
  },
};
