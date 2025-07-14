/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {RegexMatchExpr} from '../../model/malloy_types';
import {TSQLBase} from './tsql_base';

export class TSQLSQLServer extends TSQLBase {
  name = 'tsql-sqlserver';

  sqlRegexpMatch(df: RegexMatchExpr): string {
    const input = df.kids.expr.sql;
    const expression = df.kids.regex.sql;
    // TODO (vitor): Figure out a way not to need SCHEMA in here
    return `1 = malloytest.RegexpMatch(${input}, ${expression})`;
  }
}
