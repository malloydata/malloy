"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.fYearEq = exports.fStringLike = exports.fStringEq = void 0;
function fStringEq(field, value) {
    return {
        expression: [{ type: "field", path: field }, `='${value}'`],
        code: `${field}='${value}'`,
    };
}
exports.fStringEq = fStringEq;
function fStringLike(field, value) {
    return {
        expression: [{ type: "field", path: field }, ` LIKE '${value}'`],
        code: `${field}~'${value}'`,
    };
}
exports.fStringLike = fStringLike;
function fYearEq(field, year) {
    const yBegin = `'${year}-01-01 00:00:00'`;
    const yEnd = `'${year + 1}-01-01 00:00:00'`;
    const fx = { type: "field", path: field };
    return {
        expression: [fx, `>=${yBegin} and `, fx, `<${yEnd}`],
        code: `${field}:@${year}`,
    };
}
exports.fYearEq = fYearEq;
//# sourceMappingURL=test_utils.js.map