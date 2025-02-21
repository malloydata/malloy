import * as Malloy from './types';
import {maybeQuoteIdentifier} from './util';

export function queryToMalloy(
  query: Malloy.Query,
  {tabWidth} = {tabWidth: 2}
): string {
  const fragments = queryToFragments(query);
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

function wrap(open: string, block: Fragment[], close: string): Fragment[] {
  if (block.includes(NEWLINE)) {
    return [open, NEWLINE, INDENT, ...block, NEWLINE, OUTDENT, close];
  }
  return [open, ' ', ...block, ' ', close];
}

function escapeString(str: string): {contents: string; quoteCharacter: string} {
  return {contents: str, quoteCharacter: '"'}; // TODO
}

function literalToFragments(literal: Malloy.LiteralValue): Fragment[] {
  switch (literal.kind) {
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
      throw new Error('DateLiteral not implemented');
    case 'timestamp_literal':
      throw new Error('TimestampLiteral not implemented');
  }
}

function referenceToFragments(reference: Malloy.Reference): Fragment[] {
  const fragments: Fragment[] = [];
  fragments.push(maybeQuoteIdentifier(reference.name));
  if (reference.parameters) {
    const parameterFragments: Fragment[] = [];
    for (let i = 0; i < reference.parameters.length; i++) {
      const p = reference.parameters[i];
      parameterFragments.push(maybeQuoteIdentifier(p.name));
      parameterFragments.push(' is ');
      parameterFragments.push(...literalToFragments(p.value));
      if (i < reference.parameters.length - 1) {
        parameterFragments.push(', ');
      }
    }
    fragments.push(...wrap('(', parameterFragments, ')'));
  }
  return fragments;
}

function queryToFragments(query: Malloy.Query): Fragment[] {
  const fragments: Fragment[] = [];
  fragments.push('run: ');
  fragments.push(...queryDefinitionToFragments(query.definition));
  return fragments;
}

function queryDefinitionToFragments(query: Malloy.QueryDefinition): Fragment[] {
  const fragments: Fragment[] = [];
  switch (query.kind) {
    case 'arrow': {
      fragments.push(...referenceToFragments(query.source_reference));
      fragments.push(' -> ');
      fragments.push(...viewDefinitionToFragments(query.view));
      break;
    }
    case 'query_reference': {
      fragments.push(...referenceToFragments(query));
      break;
    }
    case 'refinement': {
      fragments.push(...referenceToFragments(query.query_reference));
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
      return aggregateToFragments(operations as Malloy.Aggregate[]);
    case 'group_by':
      return groupByToFragments(operations as Malloy.GroupBy[]);
    case 'order_by':
      return orderByToFragments(operations as Malloy.OrderBy[]);
    case 'nest':
      return nestToFragments(operations as Malloy.Nest[]);
    case 'limit':
      return limitToFragments(operations as Malloy.Limit[]);
    case 'where':
      return whereToFragments(operations as Malloy.Where[]);
  }
}

function aggregateToFragments(_aggregate: Malloy.Aggregate[]): Fragment[] {
  return []; // TODO
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
        '{ where: ',
        ...whereToFragments(expression.where),
        ' }',
      ];
  }
}

function groupByItemToFragments(
  groupByItem: Malloy.GroupBy,
  hideAnnotations = false
): Fragment[] {
  const fragments: Fragment[] = [];
  if (!hideAnnotations) {
    fragments.push(...annotationsToFragments(groupByItem.field.annotations));
  }
  if (groupByItem.name) {
    fragments.push(maybeQuoteIdentifier(groupByItem.name));
    fragments.push(' is ');
  }
  fragments.push(...fieldToFragments(groupByItem.field));
  return fragments;
}

function groupByToFragments(groupBy: Malloy.GroupBy[]): Fragment[] {
  const fragments: Fragment[] = [];
  const hoistAnnotations = groupBy.length === 1;
  if (hoistAnnotations) {
    fragments.push(...annotationsToFragments(groupBy[0].field.annotations));
  }
  fragments.push(
    ...formatBlock(
      'group_by',
      groupBy.map(i => groupByItemToFragments(i, hoistAnnotations))
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
  return formatBlock('nest', nest.map(nestItemToFragments));
}

function nestItemToFragments(nestItem: Malloy.Nest): Fragment[] {
  const fragments: Fragment[] = [];
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

function whereToFragments(where: Malloy.Where[]): Fragment[] {
  return formatBlock('where', where.map(whereItemToFragments));
}

function whereItemToFragments(whereItem: Malloy.Where): Fragment[] {
  switch (whereItem.filter.kind) {
    case 'filter_string':
      return [
        ...referenceToFragments(whereItem.filter.field_reference),
        ' ? ',
        `f'${whereItem.filter.filter}'`,
      ];
  }
}

function annotationsToFragments(
  annotations: Malloy.Annotation[] | undefined
): Fragment[] {
  return annotations ? annotations.flatMap(annotationToFragments) : [];
}

function annotationToFragments(annotation: Malloy.Annotation): Fragment[] {
  return [annotation.value.trim(), NEWLINE];
}
