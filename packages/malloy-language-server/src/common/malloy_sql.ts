/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {LogMessage} from '@malloydata/malloy';
import type {EmbeddedMalloyQuery} from '@malloydata/malloy-sql';

export const fixLogRange = (
  uri: string,
  malloyQuery: EmbeddedMalloyQuery,
  log: LogMessage,
  adjustment = 0
): string => {
  if (log.at) {
    if (log.at.url === 'internal://internal.malloy') {
      log.at.url = uri;
    } else if (log.at.url !== uri) {
      return '';
    }

    const embeddedStart: number = log.at.range.start.line + adjustment;
    if (embeddedStart === 0) {
      log.at.range.start.character += malloyQuery.malloyRange.start.character;
      if (log.at.range.start.line === log.at.range.end.line)
        log.at.range.end.character += malloyQuery.malloyRange.start.character;
    }

    const lineDifference = log.at.range.end.line - log.at.range.start.line;
    log.at.range.start.line = malloyQuery.range.start.line + embeddedStart;
    log.at.range.end.line =
      malloyQuery.range.start.line + embeddedStart + lineDifference;

    return `\n${log.message} at line ${log.at?.range.start.line}`;
  }
  return '';
};
