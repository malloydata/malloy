/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {CompletionParams} from 'vscode-languageserver';
import type {Position, TextDocument} from 'vscode-languageserver-textdocument';
import type {TranslateCache} from '../translate_cache';
import type {Explore, Field, Model} from '@malloydata/malloy';
import {fieldType, isFieldAggregate} from '../common/schema';

const QUERY_KEYWORDS = [
  'aggregate',
  'calculate',
  'group_by',
  'having',
  'index',
  'limit',
  'order_by',
  'select',
  'sample',
  'top',
  'where',
  'timezone',
];

const DIMENSION_KEYWORDS = [
  'select',
  'group_by',
  'order_by',
  'aggregate',
  'having',
  'order_by',
];

const MEASURE_KEYWORDS = ['aggregate', 'having'];

const EXPLORE_KEYWORDS = [
  'select',
  'group_by',
  'order_by',
  'aggregate',
  'having',
  'order_by',
];

const UNNAMED_QUERY =
  /\b(?:run|query)\s*:\s*([A-Za-z_][A-Za-z_0-9]*)\s*->\s*{/i;

const NAMED_QUERY =
  /\bquery\s*:\s*(?:[A-Za-z_][A-Za-z_0-9]*)\s+is\s+([A-Za-z_][A-Za-z_0-9]*)\s+->\s*{/i;

const FIELD_CHAIN = /\s(?:[a-zA-Z_][.A-Za-z_0-9]*)?$/;

const TOP_LEVEL_SYMBOLS = /\s*((?:source|query|run|sql)\s*:|import)\s*/i;

const LINE_COMMENTS = /\s*(--|\/\/)/g;

export async function getSchemaCompletions(
  document: TextDocument,
  context: CompletionParams,
  translateCache: TranslateCache
): Promise<string[]> {
  const parse = parseDocumentText(document.getText(), context.position);
  if (parse.nearestDefinitionText && parse.adjustedCursor) {
    const exploreName = getQueriedExploreName(parse.nearestDefinitionText);
    const {keyword, fieldChain} = getQueryContext(
      parse.nearestDefinitionText,
      parse.adjustedCursor
    );
    if (exploreName !== null && keyword !== null && fieldChain !== null) {
      let model: Model | undefined = undefined;
      try {
        model = await translateCache.translateWithTruncatedCache(
          document,
          parse.truncatedText,
          parse.exploreCount
        );
      } catch (error: unknown) {
        console.error(
          `Error fetching model for document sources and imports '${document.uri}': ${error}`
        );
      }
      if (model) {
        const exploreMap: Record<string, Explore | undefined> = {};
        model.explores.forEach(explore => {
          exploreMap[explore.name] = explore;
        });
        const explore = exploreMap[exploreName];
        if (explore) {
          const fields = getEligibleFields(fieldChain, explore, exploreMap);
          return filterCompletions(fields, keyword, fieldChain);
        }
      }
    }
  }
  return [];
}

function getQueriedExploreName(text: string[]): string | null {
  const unnamedQueryMatch = UNNAMED_QUERY.exec(text[0]);
  if (unnamedQueryMatch) {
    return unnamedQueryMatch[1];
  }
  const namedQueryMatch = NAMED_QUERY.exec(text[0]);
  return namedQueryMatch ? namedQueryMatch[1] : null;
}

function getQueryContext(lines: string[], cursor: Position) {
  lines[cursor.line] = lines[cursor.line].slice(0, cursor.character);
  const fieldChainMatch = FIELD_CHAIN.exec(lines[cursor.line]);
  const fieldChain: string | null = fieldChainMatch
    ? fieldChainMatch[0].trim()
    : null;
  let i = cursor.line;
  let keyword: string | null = null;

  if (fieldChain === null) {
    return {keyword, fieldChain};
  }

  while (i >= 0) {
    const currentLine = lines[i];
    const queryKeywords = new RegExp(
      `\\b(?:${QUERY_KEYWORDS.join('|')}):`,
      'gi'
    );
    const matches = currentLine.match(queryKeywords);
    if (matches) {
      keyword = matches[matches.length - 1]
        .slice(0, matches[matches.length - 1].length - 1)
        .toLowerCase();
      break;
    }
    i--;
  }
  return {keyword, fieldChain};
}

function getEligibleFields(
  fieldChain: string,
  explore: Explore,
  exploreMap: Record<string, Explore | undefined>
): Field[] {
  const fieldTree = fieldChain.split('.');
  fieldTree.pop();
  let currentExplore: Explore | undefined = explore;
  for (const fieldName of fieldTree) {
    if (fieldName.length === 0) {
      return [];
    }
    let validField = false;
    if (currentExplore) {
      for (const field of currentExplore.allFields) {
        if (fieldName === field.name && field.isExploreField()) {
          validField = true;
          currentExplore = exploreMap[field.name];
          break;
        }
      }
    }
    if (!validField) {
      return [];
    }
  }
  return currentExplore?.allFields || [];
}

function filterCompletions(
  fields: Field[],
  keyword: string,
  fieldChain: string
) {
  let completions: string[] = [];
  const fieldTree = fieldChain.split('.');
  const eligibleFieldsPrefix = fieldTree[fieldTree.length - 1];
  const {dimensions, measures, explores} = bucketMatchingFieldNames(
    fields,
    eligibleFieldsPrefix
  );
  if (DIMENSION_KEYWORDS.includes(keyword)) {
    completions = [...completions, ...dimensions];
  }
  if (MEASURE_KEYWORDS.includes(keyword)) {
    completions = [...completions, ...measures];
  }
  if (EXPLORE_KEYWORDS.includes(keyword)) {
    completions = [...completions, ...explores];
  }
  return completions;
}

function bucketMatchingFieldNames(fields: Field[], fieldToMatch: string) {
  const queries: string[] = [];
  const dimensions: string[] = [];
  const measures: string[] = [];
  const explores: string[] = [];
  for (const field of fields) {
    if (fieldToMatch.length === 0 || field.name.startsWith(fieldToMatch)) {
      const type = fieldType(field);
      if (isFieldAggregate(field)) {
        measures.push(field.name);
      } else if (field.isExploreField()) {
        explores.push(field.name);
      } else if (type === 'query') {
        queries.push(field.name);
      } else {
        dimensions.push(field.name);
      }
    }
  }
  return {queries, dimensions, measures, explores};
}

export interface DocumentTextParse {
  truncatedText: string;
  exploreCount: number;
  nearestDefinitionText?: string[];
  adjustedCursor?: Position;
}

export function parseDocumentText(
  text: string,
  cursor: Position
): DocumentTextParse {
  const parse: DocumentTextParse = {
    truncatedText: '',
    exploreCount: 0,
  };
  const truncatedLines: string[] = [];

  let lastSymbolStart: Position | undefined = undefined;
  let lastNonemptyLine = -1;
  let includeLines = false;

  const lines = text.split('\n');
  for (const [i, line] of lines.entries()) {
    const symbolMatches = TOP_LEVEL_SYMBOLS.exec(line);
    if (symbolMatches !== null && symbolMatches.index === 0) {
      if (
        symbolMatches[1].toLowerCase().startsWith('source') ||
        symbolMatches[1].toLowerCase().startsWith('import')
      ) {
        includeLines = true;
        parse.exploreCount++;
      } else {
        includeLines = false;
      }
      parseCurrentDefinition(
        lastSymbolStart,
        cursor,
        lastNonemptyLine,
        parse,
        lines
      );
      lastSymbolStart = {
        line: i,
        character: symbolMatches.index,
      };
    }
    if (includeLines) {
      truncatedLines.push(line);
    }
    if (!isEmptyLine(line)) {
      lastNonemptyLine = i;
    }
  }
  parseCurrentDefinition(
    lastSymbolStart,
    cursor,
    lastNonemptyLine,
    parse,
    lines
  );
  parse.truncatedText = truncatedLines.join('\n');
  return parse;
}

function parseCurrentDefinition(
  lastSymbolStart: Position | undefined,
  cursor: Position,
  lastNonemptyLine: number,
  parse: DocumentTextParse,
  lines: string[]
) {
  if (
    lastSymbolStart &&
    cursor.line >= lastSymbolStart.line &&
    cursor.line <= lastNonemptyLine
  ) {
    parse.nearestDefinitionText = lines.slice(
      lastSymbolStart.line,
      lastNonemptyLine + 1
    );
    parse.adjustedCursor = {
      line: cursor.line - lastSymbolStart.line,
      character: cursor.character,
    };
  }
}

function isEmptyLine(line: string) {
  const commentMatches = LINE_COMMENTS.exec(line);
  return (commentMatches && commentMatches.index === 0) || line.length === 0;
}
