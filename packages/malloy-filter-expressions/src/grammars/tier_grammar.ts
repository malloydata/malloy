/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {stringGrammar} from './string_grammar';

const grammar = `TierExpression
= MATCH_LIST / MATCH_TERM

MATCH_LIST
= left:MATCH_TERM COMMA _ right:TierExpression {
 return {
     type: ',',
       left: left,
       right: right
   }
}

MATCH_TERM
= not:(NOT)? term:(MATCH) {
 term.is = not ? false : true
 return term
}

`;
export const tierGrammar = grammar.concat(stringGrammar);
