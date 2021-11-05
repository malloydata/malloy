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

import { FilterExpression, Fragment } from "@malloy-lang/malloy";

export function fStringEq(field: string, value: string): FilterExpression {
  return {
    expression: [{ type: "field", path: field }, `='${value}'`],
    source: `${field}='${value}'`,
  };
}

export function fStringLike(field: string, value: string): FilterExpression {
  return {
    expression: [{ type: "field", path: field }, ` LIKE '${value}'`],
    source: `${field}~'${value}'`,
  };
}

export function fYearEq(field: string, year: number): FilterExpression {
  const yBegin = `'${year}-01-01 00:00:00'`;
  const yEnd = `'${year + 1}-01-01 00:00:00'`;
  const fx: Fragment = { type: "field", path: field };
  return {
    expression: [fx, `>=${yBegin} and `, fx, `<${yEnd}`],
    source: `${field}:@${year}`,
  };
}
