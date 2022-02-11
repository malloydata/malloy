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
import { DocumentRange } from "../model/malloy_types";

export function rangeFromContext(pcx: ParserRuleContext): DocumentRange {
  const stopToken = pcx.stop || pcx.start;
  return {
    start: {
      line: pcx.start.line - 1,
      character: pcx.start.charPositionInLine,
    },
    end: {
      line: stopToken.line - 1,
      character:
        stopToken.stopIndex -
        (stopToken.startIndex - stopToken.charPositionInLine) +
        1,
    },
  };
}
