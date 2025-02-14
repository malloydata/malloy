export interface Position {
  line: number;
  character: number;
}

// TODO: Replace this with a type from the existing API surface?'
// Temporary type to represent one column available in one schema.
interface SchemaEntry {
  name: string;
  type?: string;
}

// Temporary abstraction to represent information like schema contents
export interface MalloyData {
  schemas?: {[schemaName: string]: SchemaEntry[]};
}

export type MalloyAutocompleteCategory =
  | 'Keyword'
  | 'Identifier'
  | 'Literal'
  | 'Punctuator';

export interface AutocompleteResult {
  // The literal text that the completion would generate
  text: string;
  // A description of what the completion is trying to accomplish, intended
  // to be useful to someone who is beginner/intermediate in the Malloy language.
  description: string;
  // A category to describe the autocomplete token, which can be mapped to
  // provide an icon in contexts like Visual Studio Code.
  category: MalloyAutocompleteCategory;
}

export const getAutocompleteSuggestions = (
  input: string,
  cursorPosition: Position,
  malloyData: MalloyData = {}
): AutocompleteResult[] => {


  return [];
};

// For the sake of validating the overall approach,
// we use a "dumb" approach. Later, we go back and find better ways to
// get contextual information.
export const pretendAutocompleteSuggester = () => {
  const lastToken = "#";

  if (lastToken === '#') {
    return getRenderAnnotationCompletions();
  }
}

const getRenderAnnotationCompletions = () => {

}

const Tokens = {
  ANNOTATION: '#',
  WHERE: 'where:',
  GROUP_BY: 'group_by:',

}

// Anchor tokens are tokens which take priority when the parser encouters them,
// allowing autocomplete suggestions to appear based on local context, even
// when the overall parse tree is broken.
const ANCHOR_TOKENS = [
  Tokens.ANNOTATION,
  Tokens.WHERE,
  Tokens.GROUP_BY
];