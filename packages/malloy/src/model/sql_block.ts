/*
 * Copyright 2022 Google LLC
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

import { SQLBlock } from "./malloy_types";
import md5 from "md5";

/**
 * SQLBlockRequest does not have a digest in it
 */
export interface SQLBlockRequest extends Partial<SQLBlock> {
  select: string;
}

/**
 * The factory for SQLBlocks.
 */
export function makeSQLBlock(from: SQLBlockRequest): SQLBlock {
  const theBlock: SQLBlock = {
    digest: `md5:/${from.connection || "$default"}//${md5(from.select)}`,
    select: from.select,
  };
  if (from.before) {
    theBlock.before = from.before;
  }
  if (from.after) {
    theBlock.after = from.after;
  }
  return theBlock;
}
