import type * as Malloy from './types';
import {escapeQuoted, maybeQuoteIdentifier} from './util';

export function queryToMalloy(
  query: Malloy.Query,
  {tabWidth} = {tabWidth: 2}
): string {
  const fragments = queryToFragments(query);
  return codeFromFragments(fragments, {tabWidth});
}

export function filterToMalloy(
  filter: Malloy.Filter,
  {tabWidth} = {tabWidth: 2}
): string {
  const fragments = filterToFragments(filter);
  return codeFromFragments(fragments, {tabWidth});
}

const INDENT = Symbol('indent');
const NEWLINE = Symbol('newline');
const OUTDENT = Symbol('outdent');
const OPTIONAL_NEWLINE_INDENT = Symbol('optional_newline_indent');

type Fragment =
  | string
  | {unindented: string}
  | typeof INDENT
  | typeof OUTDENT
  | typeof NEWLINE
  | typeof OPTIONAL_NEWLINE_INDENT;

function codeFromFragments(fragments: Fragment[], {tabWidth} = {tabWidth: 2}) {
  let code = '';
  let indent = 0;
  let isStartOfLine = true;
  for (const fragment of fragments) {
    if (fragment === NEWLINE) {
      code += '\n';
      isStartOfLine = true;
    } else if (fragment === OUTDENT) {
      indent--;
    } else if (fragment === INDENT) {
      indent++;
    } else if (fragment === OPTIONAL_NEWLINE_INDENT) {
      continue; // TODO
    } else if (typeof fragment === 'object') {
      code += fragment.unindented;
      isStartOfLine = false;
    } else {
      if (isStartOfLine) {
        code += ' '.repeat(indent * tabWidth);
        isStartOfLine = false;
      }
      code += fragment;
    }
  }
  return code;
}

function wrap(
  open: string,
  block: Fragment[],
  close: string,
  options?: {spaces: boolean}
): Fragment[] {
  if (block.includes(NEWLINE)) {
    return [open, NEWLINE, INDENT, ...block, NEWLINE, OUTDENT, close];
  }
  const spaces = options?.spaces ?? true;
  const maybeSpace = spaces ? ' ' : '';
  return [open, maybeSpace, ...block, maybeSpace, close];
}

function quoteString(str: string): string {
  const quote = str.includes('"') && !str.includes("'") ? "'" : '"';
  return quote + escapeQuoted(str, quote) + quote;
}

function join(fragments: Fragment[], separator: string): Fragment[] {
  const result: Fragment[] = [];
  for (let i = 0; i < fragments.length; i++) {
    const fragment = fragments[i];
    result.push(fragment);
    if (i < fragments.length - 1) {
      result.push(separator);
    }
  }
  return result;
}

function literalToFragments(literal: Malloy.LiteralValue): Fragment[] {
  switch (literal.kind) {
    case 'filter_expression_literal':
      return [quoteFilter(literal.filter_expression_value)];
    case 'boolean_literal':
      return [literal.boolean_value.toString()];
    case 'string_literal':
      return [quoteString(literal.string_value)];
    case 'number_literal':
      // TODO big numbers etc?
      return [literal.number_value.toString()];
    case 'null_literal':
      return ['null'];
    case 'date_literal':
      return [
        serializeDateAsLiteral(
          parseDate(literal.date_value),
          literal.granularity ?? 'day',
          literal.timezone
        ),
      ];
    case 'timestamp_literal':
      return [
        serializeDateAsLiteral(
          parseDate(literal.timestamp_value),
          literal.granularity ?? 'second',
          literal.timezone
        ),
      ];
  }
}

function parseDate(date: string): string[] {
  let parts: string[] | null;

  if ((parts = /(\d\d\d\d)-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)/.exec(date))) {
    const [_, year, month, day, hours, minutes, seconds] = parts;
    return [year, month, day, hours, minutes, seconds];
  } else if ((parts = /(\d\d\d\d)-(\d\d)-(\d\d) (\d\d):(\d\d)/.exec(date))) {
    const [_, year, month, day, hours, minutes] = parts;
    return [year, month, day, hours, minutes, '00'];
  } else if ((parts = /(\d\d\d\d)-(\d\d)-(\d\d) (\d\d)(?:00)?/.exec(date))) {
    const [_, year, month, day, hours] = parts;
    return [year, month, day, hours, '00', '00'];
  } else if ((parts = /(\d\d\d\d)-(\d\d)-(\d\d)/.exec(date))) {
    const [_, year, month, day] = parts;
    return [year, month, day, '00', '00', '00'];
  } else if ((parts = /(\d\d\d\d)-(\d\d)/.exec(date))) {
    const [_, year, month] = parts;
    return [year, month, '01', '00', '00', '00'];
  } else if ((parts = /(\d\d\d\d)/.exec(date))) {
    const [_, year] = parts;
    return [year, '01', '01', '00', '00', '00'];
  }
  return ['1970', '01', '01', '00', '00', '00'];
}

function timezoneSuffix(timezone: string | undefined): string {
  if (timezone === undefined) {
    return '';
  }
  if (timezone === '' || /[\]\r\n]/.test(timezone)) {
    throw new Error(
      `Timezone ${JSON.stringify(timezone)} cannot be written in a timestamp literal, which needs a non-empty timezone without ']' or line breaks`
    );
  }
  return `[${timezone}]`;
}

function serializeDateAsLiteral(
  [year, month, day, hour, minute, second]: string[],
  granularity: Malloy.TimestampTimeframe,
  timezone: string | undefined
): string {
  switch (granularity) {
    case 'year': {
      return `@${year}`;
    }
    case 'quarter': {
      const quarter = Math.floor(+month / 3) + 1;
      return `@${year}-Q${quarter}`;
    }
    case 'month': {
      return `@${year}-${month}`;
    }
    case 'week': {
      return `@${year}-${month}-${day}-WK`;
    }
    case 'day': {
      return `@${year}-${month}-${day}`;
    }
    case 'hour': {
      return `@${year}-${month}-${day} ${hour}`;
    }
    case 'minute': {
      return `@${year}-${month}-${day} ${hour}:${minute}${timezoneSuffix(timezone)}`;
    }
    case 'second': {
      return `@${year}-${month}-${day} ${hour}:${minute}:${second}${timezoneSuffix(timezone)}`;
    }
    default:
      throw new Error('Unknown timeframe.');
  }
}

function referenceToFragments(reference: Malloy.Reference): Fragment[] {
  const fragments: Fragment[] = [];
  for (const name of reference.path ?? []) {
    fragments.push(maybeQuoteIdentifier(name));
    fragments.push('.');
  }
  fragments.push(maybeQuoteIdentifier(reference.name));
  if (reference.parameters) {
    const parameterFragments: Fragment[] = [];
    for (let i = 0; i < reference.parameters.length; i++) {
      const p = reference.parameters[i];
      parameterFragments.push(maybeQuoteIdentifier(p.name));
      parameterFragments.push(' is ');
      parameterFragments.push(...literalToFragments(p.value));
      if (i < reference.parameters.length - 1) {
        parameterFragments.push(',', NEWLINE);
      }
    }
    fragments.push(...wrap('(', parameterFragments, ')', {spaces: false}));
  }
  return fragments;
}

function queryToFragments(query: Malloy.Query): Fragment[] {
  const fragments: Fragment[] = [];
  fragments.push(...annotationsToFragments(query.annotations));
  fragments.push('run: ');
  fragments.push(...queryDefinitionToFragments(query.definition));
  return fragments;
}

function queryArrowSourceToFragments(
  query: Malloy.QueryArrowSource
): Fragment[] {
  const fragments: Fragment[] = [];
  switch (query.kind) {
    case 'source_reference': {
      fragments.push(...referenceToFragments(query));
      break;
    }
    case 'refinement':
      fragments.push(...queryDefinitionToFragments(query));
      break;
  }
  return fragments;
}

function queryDefinitionToFragments(query: Malloy.QueryDefinition): Fragment[] {
  const fragments: Fragment[] = [];
  switch (query.kind) {
    case 'arrow': {
      fragments.push(...queryArrowSourceToFragments(query.source));
      fragments.push(' -> ');
      fragments.push(...viewDefinitionToFragments(query.view));
      break;
    }
    case 'query_reference': {
      fragments.push(...referenceToFragments(query));
      break;
    }
    case 'refinement': {
      const baseFragments = queryDefinitionToFragments(query.base);
      if (query.base.kind === 'arrow') {
        fragments.push(...wrap('(', baseFragments, ')', {spaces: false}));
      } else {
        fragments.push(...baseFragments);
      }
      fragments.push(' + ');
      fragments.push(...viewDefinitionToFragments(query.refinement));
      break;
    }
  }
  return fragments;
}

function viewDefinitionToFragments(view: Malloy.ViewDefinition): Fragment[] {
  const fragments: Fragment[] = [];
  switch (view.kind) {
    case 'arrow': {
      fragments.push(...viewDefinitionToFragments(view.source));
      fragments.push(' -> ');
      fragments.push(...viewDefinitionToFragments(view.view));
      break;
    }
    case 'view_reference': {
      fragments.push(...referenceToFragments(view));
      break;
    }
    case 'refinement': {
      fragments.push(...viewDefinitionToFragments(view.base));
      fragments.push(' + ');
      fragments.push(...viewDefinitionToFragments(view.refinement));
      break;
    }
    case 'segment': {
      fragments.push(...segmentToFragments(view));
      break;
    }
  }
  return fragments;
}

function segmentToFragments(
  segment: Malloy.ViewDefinitionWithSegment
): Fragment[] {
  if (segment.operations.length === 0) return ['{ }'];
  const onMultipleLines = segment.operations.length > 1;
  const operationFragments: Fragment[] = [];
  for (let i = 0; i < segment.operations.length; i++) {
    const operation = segment.operations[i];
    const likeOperations = [operation];
    while (i < segment.operations.length - 1) {
      const nextOperation = segment.operations[i + 1];
      if (nextOperation.kind === operation.kind) {
        likeOperations.push(nextOperation);
        i++;
      } else {
        break;
      }
    }
    operationFragments.push(...groupedOperationsToFragments(likeOperations));
    if (onMultipleLines && i < segment.operations.length - 1) {
      operationFragments.push(NEWLINE);
    }
  }
  return wrap('{', operationFragments, '}');
}

function groupedOperationsToFragments(
  operations: Malloy.ViewOperation[]
): Fragment[] {
  switch (operations[0].kind) {
    case 'aggregate':
      return fieldOperationToFragments(
        operations as Malloy.Aggregate[],
        'aggregate'
      );
    case 'group_by':
      return fieldOperationToFragments(
        operations as Malloy.Aggregate[],
        'group_by'
      );
    case 'order_by':
      return orderByToFragments(operations as Malloy.OrderBy[]);
    case 'nest':
      return nestToFragments(operations as Malloy.Nest[]);
    case 'limit':
      return limitToFragments(operations as Malloy.Limit[]);
    case 'where':
      return whereToFragments(operations as Malloy.FilterOperation[]);
    case 'having':
      return havingToFragments(operations as Malloy.FilterOperation[]);
    case 'drill':
      return drillToFragments(operations as Malloy.DrillOperation[]);
    case 'calculate':
      return fieldOperationToFragments(
        operations as Malloy.Aggregate[],
        'calculate'
      );
  }
}

function formatBlock(
  label: string,
  items: Fragment[][],
  separator = ''
): Fragment[] {
  const fragments: Fragment[] = [];
  fragments.push(`${label}:`);
  const indented =
    items.length > 1 || items.some(item => item.includes(NEWLINE));
  if (indented) {
    fragments.push(NEWLINE, INDENT);
  } else {
    fragments.push(' ');
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    fragments.push(...item);
    if (items.length > 1 && i < items.length - 1) {
      fragments.push(separator);
    }
    if (indented && i < items.length - 1) {
      fragments.push(NEWLINE);
    }
  }
  if (indented) {
    fragments.push(OUTDENT);
  }
  return fragments;
}

function fieldToFragments(field: Malloy.Field): Fragment[] {
  const fragments: Fragment[] = [];
  // TODO annotations
  fragments.push(...expressionToFragments(field.expression));
  return fragments;
}

function timeUnitToFragment(timeUnit: Malloy.TimestampTimeframe): Fragment {
  return timeUnit;
}

function expressionToFragments(expression: Malloy.Expression): Fragment[] {
  switch (expression.kind) {
    case 'field_reference':
      return referenceToFragments(expression);
    case 'time_truncation':
      return [
        ...referenceToFragments(expression.field_reference),
        '.',
        timeUnitToFragment(expression.truncation),
      ];
    case 'filtered_field':
      return [
        ...referenceToFragments(expression.field_reference),
        ...wrap(' {', whereToFragments(expression.where), '}'),
      ];
    case 'literal_value':
      return literalToFragments(expression.literal_value);
    case 'moving_average': {
      const fragments = [
        'avg_moving',
        ...wrap(
          '(',
          [
            ...referenceToFragments(expression.field_reference),
            expression.rows_preceding !== undefined
              ? `, ${expression.rows_preceding}`
              : ', 0',
            expression.rows_following !== undefined
              ? `, ${expression.rows_following}`
              : '',
          ],
          ')',
          {spaces: false}
        ),
      ];

      if (expression.partition_fields?.length) {
        fragments.push(
          ...wrap(
            ' {',
            [
              'partition_by',
              ': ',
              ...join(
                expression.partition_fields.flatMap(partitionField =>
                  referenceToFragments(partitionField)
                ),
                ', '
              ),
            ],
            '}'
          )
        );
      }

      return fragments;
    }
  }
}

function fieldItemToFragments(
  item: Malloy.GroupBy | Malloy.Aggregate | Malloy.CalculateOperation,
  hideAnnotations = false
): Fragment[] {
  const fragments: Fragment[] = [];
  if (!hideAnnotations) {
    fragments.push(...annotationsToFragments(item.field.annotations));
  }
  if (item.name) {
    fragments.push(maybeQuoteIdentifier(item.name));
    fragments.push(' is ');
  }
  fragments.push(...fieldToFragments(item.field));
  return fragments;
}

function fieldOperationToFragments(
  operation:
    Malloy.GroupBy[] | Malloy.Aggregate[] | Malloy.CalculateOperation[],
  label: string
): Fragment[] {
  const fragments: Fragment[] = [];
  const hoistAnnotations = operation.length === 1;
  if (hoistAnnotations) {
    fragments.push(...annotationsToFragments(operation[0].field.annotations));
  }
  fragments.push(
    ...formatBlock(
      label,
      operation.map(i => fieldItemToFragments(i, hoistAnnotations))
    )
  );
  return fragments;
}

function orderByToFragments(orderBy: Malloy.OrderBy[]): Fragment[] {
  return formatBlock('order_by', orderBy.map(orderByItemToFragments), ',');
}

function orderByItemToFragments(orderByItem: Malloy.OrderBy): Fragment[] {
  const fragments: Fragment[] = [];
  fragments.push(...referenceToFragments(orderByItem.field_reference));
  if (orderByItem.direction) {
    fragments.push(' ');
    fragments.push(orderByItem.direction);
  }
  return fragments;
}

function nestToFragments(nest: Malloy.Nest[]): Fragment[] {
  const fragments: Fragment[] = [];
  const hoistAnnotations = nest.length === 1;
  if (hoistAnnotations) {
    fragments.push(...annotationsToFragments(nest[0].view.annotations));
  }
  fragments.push(
    ...formatBlock(
      'nest',
      nest.map(i => nestItemToFragments(i, hoistAnnotations))
    )
  );
  return fragments;
}

function nestItemToFragments(
  nestItem: Malloy.Nest,
  hideAnnotations = false
): Fragment[] {
  const fragments: Fragment[] = [];
  if (!hideAnnotations) {
    fragments.push(...annotationsToFragments(nestItem.view.annotations));
  }
  if (nestItem.name) {
    fragments.push(maybeQuoteIdentifier(nestItem.name));
    fragments.push(' is ');
  }
  fragments.push(...viewToFragments(nestItem.view));
  return fragments;
}

function viewToFragments(view: Malloy.View): Fragment[] {
  // TODO annotations
  return viewDefinitionToFragments(view.definition);
}

function limitItemToFragments(limit: Malloy.Limit): Fragment[] {
  return [`limit: ${limit.limit}`];
}

function limitToFragments(limits: Malloy.Limit[]): Fragment[] {
  const fragments: Fragment[] = [];
  for (let i = 0; i < limits.length; i++) {
    if (i !== 0) {
      fragments.push(NEWLINE);
    }
    fragments.push(...limitItemToFragments(limits[i]));
  }
  return fragments;
}

function whereToFragments(where: Malloy.FilterOperation[]): Fragment[] {
  return formatBlock('where', where.map(filterOperationItemToFragments), ',');
}

function drillToFragments(drill: Malloy.DrillOperation[]): Fragment[] {
  return formatBlock('drill', drill.map(filterOperationItemToFragments), ',');
}

function havingToFragments(having: Malloy.FilterOperation[]): Fragment[] {
  return formatBlock('having', having.map(filterOperationItemToFragments), ',');
}

// Filter strings are raw: the text between the quotes reaches the filter
// parser unchanged, and `\` only keeps the next character from ending the
// string. Adding an escape would change the filter, so a filter is written
// verbatim in the first quoting that can hold it.
const FILTER_QUOTES = ['`', "'", '"', '```', "'''", '"""'];

function quoteFilter(filter: string): string {
  const quote = FILTER_QUOTES.find(q => fitsRawQuote(filter, q));
  if (quote === undefined) {
    const problem = endsInUnpairedBackslash(filter)
      ? 'it ends in a \\ that would escape the closing quote'
      : 'its own text would end every filter quoting early';
    throw new Error(
      `Filter ${JSON.stringify(filter)} cannot be written as a Malloy filter string, which is raw: ${problem}`
    );
  }
  return `f${quote}${filter}${quote}`;
}

function endsInUnpairedBackslash(filter: string): boolean {
  let i = 0;
  while (i < filter.length) {
    i += filter[i] === '\\' ? 2 : 1;
  }
  return i > filter.length;
}

/**
 * True when `filter` followed by the closing `quote` lexes as one raw
 * string ending exactly at that closing quote.
 */
function fitsRawQuote(filter: string, quote: string): boolean {
  const multiLine = quote.length === 3;
  const text = filter + quote;
  let i = 0;
  while (i < text.length) {
    if (text.startsWith(quote, i)) {
      return i === filter.length;
    }
    if (text[i] === '\\') {
      if (!multiLine && text[i + 1] === '\n') {
        return false;
      }
      i += 2;
    } else {
      if (!multiLine && text[i] === '\n') {
        return false;
      }
      i += 1;
    }
  }
  return false;
}

function filterToFragments(filter: Malloy.Filter): Fragment[] {
  switch (filter.kind) {
    case 'filter_string':
      return [
        ...expressionToFragments(filter.expression),
        ' ~ ',
        quoteFilter(filter.filter),
      ];
    case 'literal_equality':
      return [
        ...expressionToFragments(filter.expression),
        ' = ',
        ...literalToFragments(filter.value),
      ];
  }
}

function filterOperationItemToFragments(
  whereItem: Malloy.FilterOperation
): Fragment[] {
  return filterToFragments(whereItem.filter);
}

function annotationsToFragments(
  annotations: Malloy.Annotation[] | undefined
): Fragment[] {
  return annotations ? annotations.flatMap(annotationToFragments) : [];
}

// Fixed rather than a tab stop, so no tab width can put a body line in the
// opener's column, where a `|#` body line would read as the closer.
const BLOCK_BODY_INDENT = '  ';

function annotationToFragments(annotation: Malloy.Annotation): Fragment[] {
  // The parser stores annotation text with LF line endings
  const value = annotation.value.trimStart().replace(/\r\n/g, '\n');
  const isBlock = value.startsWith('#|');
  // A line annotation's text keeps its line ending; a block's text has only
  // the line ending of its last body line removed, so every other newline in
  // a block is a body line.
  const text = isBlock ? value : value.replace(/\n$/, '');
  const problem = !text.startsWith('#')
    ? 'it does not start with #'
    : text.startsWith('##')
      ? '## marks a model annotation'
      : text.includes('\r')
        ? 'it contains a carriage return that is not part of a line ending'
        : !isBlock && text.includes('\n')
          ? 'a multi-line annotation must start with #|'
          : undefined;
  if (problem !== undefined) {
    throw new Error(
      `Annotation ${JSON.stringify(annotation.value)} cannot be written as an object annotation: ${problem}`
    );
  }
  if (!isBlock) {
    return [text, NEWLINE];
  }
  // A block annotation's text is its opening line and its dedented body; the
  // closing line is not part of it. The parser dedents the body by the
  // indentation its non-blank lines share, which removes the added indent
  // again. A body with no non-blank line is not dedented, so it is written
  // exactly as stored; it cannot contain a closer.
  const [opener, ...body] = text.split('\n');
  const dedented = body.some(line => /\S/.test(line));
  const bodyFragments = body.flatMap((line): Fragment[] => {
    if (line === '') {
      return [NEWLINE];
    }
    return [dedented ? BLOCK_BODY_INDENT + line : {unindented: line}, NEWLINE];
  });
  return [opener, NEWLINE, ...bodyFragments, '|#', NEWLINE];
}
