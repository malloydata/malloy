import {MalloyParser} from '../lib/Malloy/MalloyParser';
import {ErrorCase} from './error-case-checker';

// A set of custom error messages and their triggering cases,
// used for syntax error message re-writing when ANTLR would
// otherwise print a standard (and not very useful) error message.
//
// Most Malloy errors are detected and generated in language elements
// inside `src/lang/ast`. These custom error messages are used to
// cover a variety of cases that are not as straightforward to
// catch in the AST.
export const malloyCustomErrorCases: ErrorCase[] = [
  {
    errorMessage: "'view:' must be followed by '<identifier> is {'",
    ruleContextOptions: ['exploreQueryDef'],
    offendingSymbol: MalloyParser.OCURLY,
    precedingTokenOptions: [[MalloyParser.VIEW], [MalloyParser.COLON]],
  },
  {
    errorMessage: "Missing '}' at '${offendingSymbol}'",
    ruleContextOptions: ['vExpr'],
    offendingSymbol: MalloyParser.VIEW,
    currentToken: MalloyParser.OCURLY,
  },
  {
    errorMessage: "Missing '}' at '${currentToken}'",
    ruleContextOptions: [
      'exploreProperties',
      'queryProperties',
      'exploreStatement',
    ],
    offendingSymbolTextOptions: ['<eof>', 'run:', 'source:'],
  },
  {
    errorMessage:
      "'aggregate:' entries must include a name (ex: `some_name is count()`)",
    precedingTokenOptions: [[MalloyParser.AGGREGATE]],
    lookAheadOptions: [[-MalloyParser.IS]],
  },
  {
    errorMessage: "Expected ':' following 'source'",
    offendingSymbol: MalloyParser.SOURCE_KW,
    ruleContextOptions: ['malloyDocument'],
  },
  {
    errorMessage: "Expected ':' following '${offendingSymbol}'",
    offendingSymbolTextOptions: [
      'dimension',
      'measure',
      'where',
      'declare',
      'join_one',
      'join_many',
      'join_cross',
      'primary_key',
    ],
    ruleContextOptions: ['exploreStatement'],
  },
  {
    errorMessage:
      "Expected 'is' or '(' following identifier '${previousToken}'",
    ruleContextOptions: ['sourceDefinition'],
    lookbackSiblingRuleOptions: [
      MalloyParser.RULE_sourceNameDef,
      MalloyParser.RULE_sourceParameters,
    ],
  },
  {
    errorMessage:
      "Unexpected '{' following source expression. Expected: 'extend', 'include', '+' or '->'",
    offendingSymbol: MalloyParser.OCURLY,
    ruleContextOptions: ['malloyDocument'],
    predecessorHasAncestorRule: MalloyParser.RULE_sqExplore,
  },
  {
    errorMessage:
      "Unexpected 'join:'. Did you mean 'join_one:', 'join_many:' or 'join_cross:'?",
    ruleContextOptions: ['exploreStatement'],
    offendingSymbolTextOptions: ['join'],
    lookAheadOptions: [[MalloyParser.COLON]],
  },
  {
    errorMessage:
      "Unexpected '${offendingSymbol}'. Did you mean 'primary_key:'?",
    ruleContextOptions: ['exploreStatement'],
    offendingSymbolTextOptions: ['primarykey', 'primary'],
    lookAheadOptions: [
      [MalloyParser.COLON],
      ['key', MalloyParser.COLON],
      ['key', MalloyParser.IDENTIFIER],
    ],
  },
  {
    errorMessage: "Unexpected '${offendingSymbol}'. Did you mean 'group_by:'?",
    ruleContextOptions: ['queryStatement'],
    offendingSymbolTextOptions: ['groupby', 'group'],
    lookAheadOptions: [
      [MalloyParser.COLON],
      ['by', MalloyParser.COLON],
      ['by', MalloyParser.IDENTIFIER],
    ],
  },
  {
    errorMessage: "Unexpected '${offendingSymbol}'. Did you mean 'order_by:'?",
    ruleContextOptions: ['queryStatement'],
    offendingSymbolTextOptions: ['orderby', 'order'],
    lookAheadOptions: [
      [MalloyParser.COLON],
      ['by', MalloyParser.COLON],
      ['by', MalloyParser.IDENTIFIER],
    ],
  },
  {
    errorMessage: "Expected ':' following '${offendingSymbol}'",
    offendingSymbolTextOptions: [
      'group_by',
      'declare',
      'join_one',
      'join_many',
      'join_cross',
      'extend',
      'select',
      'project',
      'index',
      'aggregate',
      'calculate',
      'top',
      'limit',
      'order_by',
      'where',
      'having',
      'nest',
      'sample',
      'timezone',
    ],
    ruleContextOptions: ['queryStatement'],
  },
];
