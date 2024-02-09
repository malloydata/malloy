/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
export const numbers = `
/* Common numbers parsing expressions */

number "number"
 = (minus? int frac? exp?) { return getNumberFromString(text()); } / (minus? int? frac exp?) { return getNumberFromString(text()); } 

positive "positive"
 = int frac? exp? { return getNumberFromString(text()); }

positiveInteger "positive integer"
= int { return getNumberFromString(text()); }

integer "integer"
 = minus? int { return getNumberFromString(text()); }

not = "not"i
decimal_point = "."
digit1_9      = [1-9]
e             = [eE]
exp           = e (minus / plus)? DIGIT+
frac          = decimal_point DIGIT+
int           = zero / (digit1_9 DIGIT*)
minus         = "-"
plus          = "+"
zero          = "0"
DIGIT  = [0-9]
`;
