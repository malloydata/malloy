import type {Token} from 'antlr4ts';
import {CharStreams} from 'antlr4ts';
import {HandlesOverpoppingLexer} from './run-malloy-parser';
import type {Position} from '@malloydata/malloy-interfaces';
import {MalloyParser} from './lib/Malloy/MalloyParser';

const sourceNameIdentifierTokens = [
  MalloyParser.SOURCE,
  MalloyParser.RUN,
  MalloyParser.QUERY,
];

const completionTriggerTokens = [
  MalloyParser.WHERE,
  MalloyParser.GROUP_BY,
  MalloyParser.AGGREGATE,
  MalloyParser.WITH,
];

export type SourceNameToSchemaMap = {[id: string]: string[]};

export const computeMalloyCompletions = (
  input: string,
  // Expects a 1-based position, as is used in VS Code and other editors
  position: Position,
  schema: SourceNameToSchemaMap
): string[] => {
  const inputStream = CharStreams.fromString(input);
  const lexer = new HandlesOverpoppingLexer(inputStream);
  const tokens: Token[] = lexer.getAllTokens();
  // // Convert from 1- to 0- based position for computations
  // const position = {
  //   line: oneBasedPosition.line - 1,
  //   character: oneBasedPosition.character - 1,
  // };

  const sourceNames: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // Handle the case when the cursor is inside of a token, in which case the
    // possible values are determined by the previous token.
    if (
      i > 0 &&
      t.line === position.line &&
      t.charPositionInLine <= position.character &&
      position.character < t.charPositionInLine + (t.text?.length || 1)
    ) {
      return getCompletionsForTokenAtPosition(
        tokens,
        i - 1,
        sourceNames,
        schema
      );
      // Handle the case when the cursor is between tokens, or at the end of the line (common),
    } else if (
      t.line === position.line &&
      position.character >= t.charPositionInLine + (t.text?.length || 1) &&
      (i === tokens.length - 1 ||
        position.line < tokens[i + 1].line ||
        position.character < tokens[i + 1].charPositionInLine)
    ) {
      return getCompletionsForTokenAtPosition(tokens, i, sourceNames, schema);
    } else if (sourceNameIdentifierTokens.includes(t.type)) {
      if (i < tokens.length - 1) {
        sourceNames.push(tokens[i + 1].text || '');
      }
    }
  }

  return [];
};

const getCompletionsForTokenAtPosition = (
  tokens: Token[],
  i: number,
  sourceNames: string[],
  schema: SourceNameToSchemaMap
): string[] => {
  if (completionTriggerTokens.includes(tokens[i].type)) {
    // const sourceName = determineSourceNameForPosition(tokens, position);
    const sourceName =
      sourceNames.length > 0 ? sourceNames[sourceNames.length - 1] : '';
    const completions = schema[sourceName];
    if (completions) {
      return completions;
    }
  }

  return [];
};
