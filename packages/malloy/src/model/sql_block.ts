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

import { isSQLFragment, SQLBlockSource, SQLPhrase } from "./malloy_types";
import md5 from "md5";

/**
 * The factory for SQLBlocks. Exists because the name is computed
 * from the components of the block and that name needs to be
 * unique, but predictable.
 */
export function makeSQLBlock(
  select: SQLPhrase[],
  connection?: string
): SQLBlockSource {
  const theBlock: SQLBlockSource = {
    name: `md5:/${connection || "$default"}//${nameFor(select)}`,
    select,
  };
  if (connection) {
    theBlock.connection = connection;
  }
  return theBlock;
}

// This feels like wrongness on toast, before SQL contained a query we
// could compute a stable hash from the select property to use to
// indentify this piece of SQL. Now the actual SQL isn't known until
// runtime and I am not certain what the right thing to do is, and
// at this moment when I am still trying to imagine how this is all
// going to work, I am using stringify(), but I suspect I will be back
// here for later, and that the whole "how to determine the name of a query"
// algorithm needs to change
function nameFor(select: SQLPhrase[]): string {
  const phrases = select.map((el) => {
    isSQLFragment(el) ? el.sql : JSON.stringify(el);
  });
  return md5(phrases.join(";"));
}
