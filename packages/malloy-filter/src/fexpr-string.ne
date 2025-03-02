@preprocessor typescript
@{%
import moo from 'moo';

const fstring_lexer = moo.compile({
  comma: ',',
  semi: ';',
  open: '(',
  close: ')',
  or: '|',
  not: '-',
  keyword: ['null', 'NULL', 'empty', 'EMPTY'],
  matchStr: /\s*(?:\\[^\n]|[^\n,;()|])+\s*/,
})
%}

@lexer fstring_lexer

stringFilter ->
    %minus sfBinary {% ([_, expr]) => ({...expr, not: true}) %}
  | sfBinary

sfBinary ->
    sfBinary conjunction clause {% ([left, cop, right]) => ({op: cop[0].text, left, right}) %}
  | clause

clause ->
    %keyword {% ([kw])=> ({op: kw.text}) %}
  | %matchStr {% ([withStr]) => ({op: "=~", match: withStr.text}) %}
  | %open stringFilter %close {% ([subFilter]) => ({op: "()", expr: subFilter}) %}

conjunction -> %comma | %semi | %or
