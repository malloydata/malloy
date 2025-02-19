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
  switch (literal.__type) {
    case Malloy.LiteralValueType.BooleanLiteral:
      return [literal.boolean_value.toString()];
    case Malloy.LiteralValueType.StringLiteral: {
      const {contents, quoteCharacter} = escapeString(literal.string_value);
      return [quoteCharacter, contents, quoteCharacter];
    }
    case Malloy.LiteralValueType.NumberLiteral:
      // TODO big numbers etc?
      return [literal.number_value.toString()];
    case Malloy.LiteralValueType.NullLiteral:
      return ['null'];
    case Malloy.LiteralValueType.DateLiteral:
      throw new Error('DateLiteral not implemented');
    case Malloy.LiteralValueType.TimestampLiteral:
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
  if (query.source) {
    fragments.push(...referenceToFragments(query.source));
  }
  fragments.push(' -> ');
  fragments.push(...pipelineToFragments(query.pipeline));
  return fragments;
}

function pipelineToFragments(pipeline: Malloy.Pipeline): Fragment[] {
  const fragments: Fragment[] = [];
  for (let i = 0; i < pipeline.stages.length; i++) {
    const stage = pipeline.stages[i];
    if (i > 0) {
      fragments.push(' -> ');
    }
    fragments.push(...stageToFragments(stage));
  }
  return fragments;
}

function stageToFragments(stage: Malloy.PipeStage): Fragment[] {
  const fragments: Fragment[] = [];
  for (let i = 0; i < stage.refinements.length; i++) {
    const refinement = stage.refinements[i];
    if (i > 0) {
      fragments.push(' + ');
    }
    fragments.push(...refinementToFragments(refinement));
  }
  return fragments;
}

function refinementToFragments(refinement: Malloy.Refinement): Fragment[] {
  switch (refinement.__type) {
    case Malloy.RefinementType.Reference:
      return referenceToFragments(refinement);
    case Malloy.RefinementType.Segment:
      return segmentToFragments(refinement);
  }
}

function segmentToFragments(segment: Malloy.Segment): Fragment[] {
  const onMultipleLines = segment.operations.length > 1;
  const operationFragments: Fragment[] = [];
  for (let i = 0; i < segment.operations.length; i++) {
    const operation = segment.operations[i];
    operationFragments.push(...operationToFragments(operation));
    if (onMultipleLines && i < segment.operations.length - 1) {
      operationFragments.push(NEWLINE);
    }
  }
  return wrap('{', operationFragments, '}');
}

function operationToFragments(operation: Malloy.ViewOperation): Fragment[] {
  switch (operation.__type) {
    case Malloy.ViewOperationType.Aggregate:
      return aggregateToFragments(operation);
    case Malloy.ViewOperationType.GroupBy:
      return groupByToFragments(operation);
    case Malloy.ViewOperationType.OrderBy:
      return orderByToFragments(operation);
    case Malloy.ViewOperationType.Nest:
      return nestToFragments(operation);
    case Malloy.ViewOperationType.Limit:
      return limitToFragments(operation);
    case Malloy.ViewOperationType.Where:
      return whereToFragments(operation);
  }
}

function aggregateToFragments(_aggregate: Malloy.Aggregate): Fragment[] {
  return []; // TODO
}

function formatBlock(
  label: string,
  items: Fragment[][],
  separator = ''
): Fragment[] {
  const fragments: Fragment[] = [];
  fragments.push(`${label}:`);
  const indented = items.length > 1;
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
  switch (timeUnit) {
    case Malloy.TimestampTimeframe.SECOND:
      return 'second';
    case Malloy.TimestampTimeframe.MINUTE:
      return 'minute';
    case Malloy.TimestampTimeframe.HOUR:
      return 'hour';
    case Malloy.TimestampTimeframe.DAY:
      return 'day';
    case Malloy.TimestampTimeframe.WEEK:
      return 'week';
    case Malloy.TimestampTimeframe.MONTH:
      return 'month';
    case Malloy.TimestampTimeframe.QUARTER:
      return 'quarter';
    case Malloy.TimestampTimeframe.YEAR:
      return 'year';
  }
}

function expressionToFragments(expression: Malloy.Expression): Fragment[] {
  switch (expression.__type) {
    case Malloy.ExpressionType.Reference:
      return referenceToFragments(expression);
    case Malloy.ExpressionType.TimeTruncation:
      return [
        ...referenceToFragments(expression.reference),
        '.',
        timeUnitToFragment(expression.truncation),
      ];
    case Malloy.ExpressionType.FilteredField:
      return [
        ...referenceToFragments(expression.reference),
        '{ where: ',
        ...whereItemToFragments(expression.filter),
        ' }',
      ];
  }
}

function groupByItemToFragments(groupByItem: Malloy.GroupByItem): Fragment[] {
  const fragments: Fragment[] = [];
  if (groupByItem.name) {
    fragments.push(maybeQuoteIdentifier(groupByItem.name));
    fragments.push(' is ');
  }
  fragments.push(...fieldToFragments(groupByItem.field));
  return fragments;
}

function groupByToFragments(groupBy: Malloy.GroupBy): Fragment[] {
  return formatBlock('group_by', groupBy.items.map(groupByItemToFragments));
}

function orderByToFragments(orderBy: Malloy.OrderBy): Fragment[] {
  return formatBlock(
    'order_by',
    orderBy.items.map(orderByItemToFragments),
    ','
  );
}

function orderByItemToFragments(orderByItem: Malloy.OrderByItem): Fragment[] {
  const fragments: Fragment[] = [];
  fragments.push(...referenceToFragments(orderByItem.field));
  if (orderByItem.direction) {
    fragments.push(' ');
    fragments.push(
      orderByItem.direction === Malloy.OrderByDirection.ASC ? 'asc' : 'desc'
    );
  }
  return fragments;
}

function nestToFragments(nest: Malloy.Nest): Fragment[] {
  return formatBlock('nest', nest.items.map(nestItemToFragments));
}

function nestItemToFragments(nestItem: Malloy.NestItem): Fragment[] {
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
  return pipelineToFragments(view.pipeline);
}

function limitToFragments(limit: Malloy.Limit): Fragment[] {
  return [`limit: ${limit.limit}`];
}

function whereToFragments(where: Malloy.Where): Fragment[] {
  return formatBlock('where', where.items.map(whereItemToFragments));
}

function whereItemToFragments(whereItem: Malloy.WhereItem): Fragment[] {
  switch (whereItem.__type) {
    case Malloy.WhereItemType.FilterString:
      return [
        ...referenceToFragments(whereItem.field),
        ' ? ',
        `f'${whereItem.filter}'`,
      ];
  }
}
