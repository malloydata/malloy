/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {LogMessage} from '@malloydata/malloy';
import {MalloyError} from '@malloydata/malloy';
import type {MalloySQLParseErrorExpected} from './types';

export class MalloySQLParseError extends MalloyError {
  constructor(message: string, problems: LogMessage[] = []) {
    super(message, problems);
  }
}

export class MalloySQLSyntaxError extends MalloySQLParseError {
  public expected: MalloySQLParseErrorExpected[];
  public found: string;

  constructor(
    message: string,
    log: LogMessage[],
    expected: MalloySQLParseErrorExpected[],
    found: string
  ) {
    super(message, log);
    this.expected = expected;
    this.found = found;
  }
}
