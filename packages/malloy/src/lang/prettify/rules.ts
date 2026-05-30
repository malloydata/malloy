/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 *
 * Section-statement dispatch table and statement-kind labels.
 *
 * SECTION_STATEMENT_RULES is the table of `keyword: items` rules that need
 * flow-fill, column alignment, or annotation-aware item handling. Section
 * keywords NOT in this table fall through to the leaf walker, which produces
 * correct-but-plain output. Add a row here only when the default isn't good
 * enough.
 *
 * STATEMENT_KIND_BY_CTX is the coarse grouping used by the block-body rule
 * to decide whether two adjacent statements should preserve a user-supplied
 * blank line (different kinds: yes; same kind: no).
 *
 * A maintainer adding a new section-statement lands here first.
 */

import type {ParserRuleContext} from 'antlr4ts';
import * as parser from '../lib/Malloy/MalloyParser';
import {L} from './tokens';

export type ItemKind =
  | 'fieldEntry'
  | 'nestEntry'
  | 'fieldDef'
  | 'fieldName'
  | 'collectionMember'
  | 'orderBySpec'
  | 'fieldExpr'
  | 'joinDef'
  | 'includeField'
  | 'indexElement'
  | 'givenDef';

// One row per `keyword: items` rule we handle. The `list` accessor returns
// the list-context child; the `keywordTypes` are the lexer token types that
// could appear as the statement's keyword (most have one; ACCEPT/EXCEPT
// share a rule).
export interface SectionRule {
  ctxClass: new (...args: never[]) => ParserRuleContext;
  keywordTypes: number[];
  list: (ctx: ParserRuleContext) => ParserRuleContext | undefined;
  itemKind: ItemKind;
}

// Constructs a SectionRule with the list-accessor closure typed against the
// concrete context class. The single internal narrowing is justified: the
// dispatcher only invokes `rule.list(node)` after `node instanceof
// rule.ctxClass`, so at runtime the parameter really is of type `C`.
function rule<C extends ParserRuleContext>(
  ctxClass: new (...args: never[]) => C,
  keywordTypes: number[],
  list: (c: C) => ParserRuleContext | undefined,
  itemKind: ItemKind
): SectionRule {
  return {
    ctxClass,
    keywordTypes,
    list: ctx => list(ctx as C),
    itemKind,
  };
}

export const SECTION_STATEMENT_RULES: SectionRule[] = [
  rule(
    parser.AggregateStatementContext,
    [L.AGGREGATE],
    c => c.queryFieldList(),
    'fieldEntry'
  ),
  rule(
    parser.GroupByStatementContext,
    [L.GROUP_BY],
    c => c.queryFieldList(),
    'fieldEntry'
  ),
  rule(
    parser.CalculateStatementContext,
    [L.CALCULATE],
    c => c.queryFieldList(),
    'fieldEntry'
  ),
  rule(
    parser.NestStatementContext,
    [L.NEST],
    c => c.nestedQueryList(),
    'nestEntry'
  ),
  rule(
    parser.DeclareStatementContext,
    [L.DECLARE],
    c => c.defList(),
    'fieldDef'
  ),
  rule(parser.DefMeasuresContext, [L.MEASURE], c => c.defList(), 'fieldDef'),
  rule(
    parser.DefDimensionsContext,
    [L.DIMENSION],
    c => c.defList(),
    'fieldDef'
  ),
  rule(
    parser.DefExploreEditFieldContext,
    [L.ACCEPT, L.EXCEPT],
    c => c.fieldNameList(),
    'fieldName'
  ),
  rule(
    parser.ProjectStatementContext,
    [L.SELECT],
    c => c.fieldCollection(),
    'collectionMember'
  ),
  rule(
    parser.OrderByStatementContext,
    [L.ORDER_BY],
    c => c.ordering(),
    'orderBySpec'
  ),
  rule(
    parser.WhereStatementContext,
    [L.WHERE],
    c => c.filterClauseList(),
    'fieldExpr'
  ),
  rule(
    parser.HavingStatementContext,
    [L.HAVING],
    c => c.filterClauseList(),
    'fieldExpr'
  ),
  rule(parser.DefJoinOneContext, [L.JOIN_ONE], c => c.joinList(), 'joinDef'),
  rule(parser.DefJoinManyContext, [L.JOIN_MANY], c => c.joinList(), 'joinDef'),
  rule(
    parser.DefJoinCrossContext,
    [L.JOIN_CROSS],
    c => c.joinList(),
    'joinDef'
  ),
  // include block items: `public: a, b`, `internal: x, y, z`. The keyword
  // (PUBLIC/PRIVATE/INTERNAL) lives one level down inside accessLabelProp;
  // findKeyword in ./sections handles that nested case.
  rule(
    parser.IncludeItemContext,
    [L.PUBLIC, L.PRIVATE, L.INTERNAL],
    c => c.includeList(),
    'includeField'
  ),
  rule(
    parser.IndexStatementContext,
    [L.INDEX],
    c => c.indexFields(),
    'indexElement'
  ),
  rule(
    parser.DefineGivenStatementContext,
    [L.GIVEN],
    c => c.givenDefList(),
    'givenDef'
  ),
];

// Coarse statement-kind labels for the same-kind-no-blank rule in block
// bodies. Different kinds preserve a single user-supplied blank line.
export const STATEMENT_KIND_BY_CTX: Array<{
  ctxClass: new (...args: never[]) => ParserRuleContext;
  kind: string;
}> = [
  {ctxClass: parser.JoinStatementContext, kind: 'join'},
  {ctxClass: parser.QueryJoinStatementContext, kind: 'join'},
  {ctxClass: parser.DefMeasuresContext, kind: 'measure'},
  {ctxClass: parser.DefDimensionsContext, kind: 'dimension'},
  {ctxClass: parser.DeclareStatementContext, kind: 'declare'},
  {ctxClass: parser.AggregateStatementContext, kind: 'aggregate'},
  {ctxClass: parser.GroupByStatementContext, kind: 'group_by'},
  {ctxClass: parser.CalculateStatementContext, kind: 'calculate'},
  {ctxClass: parser.NestStatementContext, kind: 'nest'},
  {ctxClass: parser.WhereStatementContext, kind: 'where'},
  {ctxClass: parser.HavingStatementContext, kind: 'having'},
  {ctxClass: parser.OrderByStatementContext, kind: 'order_by'},
  {ctxClass: parser.ProjectStatementContext, kind: 'select'},
  {ctxClass: parser.DefExploreEditFieldContext, kind: 'edit_field'},
  {ctxClass: parser.DefExploreRenameContext, kind: 'rename'},
  {ctxClass: parser.DefExploreQueryContext, kind: 'view'},
];
