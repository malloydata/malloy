/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { ParserRuleContext } from "antlr4ts";

export interface Position {
  line: number;
  char: number;
}

export interface Range {
  begin: Position;
  end: Position;
}

export function rangeFromContext(pcx: ParserRuleContext): Range {
  const stopToken = pcx.stop || pcx.start;
  return {
    begin: {
      line: pcx.start.line,
      char: pcx.start.charPositionInLine,
    },
    end: {
      line: stopToken.line,
      char:
        stopToken.stopIndex -
        (stopToken.startIndex - stopToken.charPositionInLine) +
        1,
    },
  };
}
