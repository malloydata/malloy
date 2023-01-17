/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { isSQLFragment, SQLBlockSource, SQLPhrase } from "./malloy_types";
import { generateHash } from "./utils";

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
  const phrases = select.map((el) =>
    isSQLFragment(el) ? el.sql : JSON.stringify(el)
  );
  return generateHash(phrases.join(";"));
}
