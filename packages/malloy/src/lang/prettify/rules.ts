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
  | 'fieldExpr';

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

export const SECTION_STATEMENT_RULES: SectionRule[] = [
  {
    ctxClass: parser.AggregateStatementContext,
    keywordTypes: [L.AGGREGATE],
    list: c => (c as parser.AggregateStatementContext).queryFieldList(),
    itemKind: 'fieldEntry',
  },
  {
    ctxClass: parser.GroupByStatementContext,
    keywordTypes: [L.GROUP_BY],
    list: c => (c as parser.GroupByStatementContext).queryFieldList(),
    itemKind: 'fieldEntry',
  },
  {
    ctxClass: parser.CalculateStatementContext,
    keywordTypes: [L.CALCULATE],
    list: c => (c as parser.CalculateStatementContext).queryFieldList(),
    itemKind: 'fieldEntry',
  },
  {
    ctxClass: parser.NestStatementContext,
    keywordTypes: [L.NEST],
    list: c => (c as parser.NestStatementContext).nestedQueryList(),
    itemKind: 'nestEntry',
  },
  {
    ctxClass: parser.DeclareStatementContext,
    keywordTypes: [L.DECLARE],
    list: c => (c as parser.DeclareStatementContext).defList(),
    itemKind: 'fieldDef',
  },
  {
    ctxClass: parser.DefMeasuresContext,
    keywordTypes: [L.MEASURE],
    list: c => (c as parser.DefMeasuresContext).defList(),
    itemKind: 'fieldDef',
  },
  {
    ctxClass: parser.DefDimensionsContext,
    keywordTypes: [L.DIMENSION],
    list: c => (c as parser.DefDimensionsContext).defList(),
    itemKind: 'fieldDef',
  },
  {
    ctxClass: parser.DefExploreEditFieldContext,
    keywordTypes: [L.ACCEPT, L.EXCEPT],
    list: c => (c as parser.DefExploreEditFieldContext).fieldNameList(),
    itemKind: 'fieldName',
  },
  {
    ctxClass: parser.ProjectStatementContext,
    keywordTypes: [L.SELECT],
    list: c => (c as parser.ProjectStatementContext).fieldCollection(),
    itemKind: 'collectionMember',
  },
  {
    ctxClass: parser.OrderByStatementContext,
    keywordTypes: [L.ORDER_BY],
    list: c => (c as parser.OrderByStatementContext).ordering(),
    itemKind: 'orderBySpec',
  },
  {
    ctxClass: parser.WhereStatementContext,
    keywordTypes: [L.WHERE],
    list: c => (c as parser.WhereStatementContext).filterClauseList(),
    itemKind: 'fieldExpr',
  },
  {
    ctxClass: parser.HavingStatementContext,
    keywordTypes: [L.HAVING],
    list: c => (c as parser.HavingStatementContext).filterClauseList(),
    itemKind: 'fieldExpr',
  },
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
