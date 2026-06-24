import type * as Malloy from './types';
import {maybeQuoteIdentifier} from './util';

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

function escapeString(str: string): {contents: string; quoteCharacter: string} {
  return {contents: str, quoteCharacter: '"'}; // TODO
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
    case 'string_literal': {
      const {contents, quoteCharacter} = escapeString(literal.string_value);
      return [quoteCharacter, contents, quoteCharacter];
    }
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
      return `@${year}-${month}-${day} ${hour}:${minute}`;
    }
    case 'second': {
      if (timezone !== undefined) {
        return `@${year}-${month}-${day} ${hour}:${minute}:${second}[${timezone}]`;
      }
      return `@${year}-${month}-${day} ${hour}:${minute}:${second}`;
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
    | Malloy.GroupBy[]
    | Malloy.Aggregate[]
    | Malloy.CalculateOperation[],
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

function formatFilterBlock(
  label: string,
  operations: Malloy.FilterOperation[]
): Fragment[] {
  const items = operations.map(filterOperationItemToFragments);
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
    const operation = operations[i];
    // For items after the first, add the separator/conjunction
    if (i > 0) {
      // Use the conjunction from the CURRENT operation (how it connects to previous)
      const conjunction = operation.conjunction;
      if (conjunction === 'and') {
        fragments.push('and ');
      } else if (conjunction === 'or') {
        fragments.push('or ');
      } else {
        // No conjunction specified, this shouldn't happen for items after first
        // but we handle it gracefully by just adding the item without separator
      }
    }
    fragments.push(...item);
    if (indented && i < items.length - 1) {
      // Add comma only if the NEXT item doesn't have a conjunction
      const nextOperation = operations[i + 1];
      if (!nextOperation.conjunction) {
        fragments.push(',');
      }
      fragments.push(NEWLINE);
    }
  }
  if (indented) {
    fragments.push(OUTDENT);
  }
  return fragments;
}

function whereToFragments(where: Malloy.FilterOperation[]): Fragment[] {
  return formatFilterBlock('where', where);
}

function drillToFragments(drill: Malloy.DrillOperation[]): Fragment[] {
  return formatBlock('drill', drill.map(filterOperationItemToFragments), ',');
}

function havingToFragments(having: Malloy.FilterOperation[]): Fragment[] {
  return formatFilterBlock('having', having);
}

const FILTER_QUOTES = ['`', "'", '"']; // technically , '"""', "'''" are valid too, but they're ugly

function quoteFilter(filter: string): string {
  let bestQuote: string | undefined = undefined;
  let bestEscaped: string | undefined = undefined;
  for (const quote of FILTER_QUOTES) {
    const escaped = escapeFilter(filter, quote);
    if (escaped === filter) {
      return `f${quote}${filter}${quote}`;
    }
    if (bestEscaped === undefined || escaped.length < bestEscaped.length) {
      bestQuote = quote;
      bestEscaped = escaped;
    }
  }
  return `f${bestQuote}${bestEscaped}${bestQuote}`;
}

function escapeFilter(filter: string, quote: string): string {
  let result = '';
  for (let i = 0; i < filter.length; i++) {
    if (filter.slice(i).startsWith(quote)) {
      result += '\\' + quote;
      i += quote.length;
    } else {
      result += filter[i];
      if (filter[i] === '\\') {
        result += filter[++i];
      }
    }
  }
  return result;
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

function annotationToFragments(annotation: Malloy.Annotation): Fragment[] {
  return [annotation.value.trim(), NEWLINE];
}
