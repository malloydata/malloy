/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import {v4 as uuidv4} from 'uuid';
import type {
  QueryInfo,
  Dialect,
  DialectFieldList,
  FieldReferenceType,
} from '../dialect';
import {getDialect} from '../dialect';
import {StandardSQLDialect} from '../dialect/standardsql/standardsql';
import type {
  AggregateFunctionType,
  Annotation,
  CompiledQuery,
  Expr,
  FieldDef,
  Filtered,
  FunctionOverloadDef,
  FunctionParameterDef,
  IndexFieldDef,
  IndexSegment,
  JoinRelationship,
  ModelDef,
  OrderBy,
  OutputFieldNode,
  Parameter,
  ParameterNode,
  PipeSegment,
  Query,
  QueryFieldDef,
  QuerySegment,
  RefToField,
  ResultMetadataDef,
  ResultStructMetadataDef,
  SearchIndexResult,
  SegmentFieldDef,
  StructDef,
  StructRef,
  TurtleDef,
  FunctionOrderBy,
  Argument,
  AggregateExpr,
  FilterCondition,
  GenericSQLExpr,
  FieldnameNode,
  FunctionCallNode,
  UngroupNode,
  SourceReferenceNode,
  TimeTruncExpr,
  SpreadExpr,
  FilteredExpr,
  SourceDef,
  StringFieldDef,
  NumberFieldDef,
  BooleanFieldDef,
  JSONFieldDef,
  NativeUnsupportedFieldDef,
  DateFieldDef,
  DateUnit,
  TimestampUnit,
  NestSourceDef,
  TimestampFieldDef,
  QueryResultDef,
  RecordDef,
  FinalizeSourceDef,
  QueryToMaterialize,
  PrepareResultOptions,
  RepeatedRecordDef,
  CaseExpr,
  TemporalTypeDef,
  JoinFieldDef,
  BasicAtomicDef,
  Expression,
  AtomicFieldDef,
  FilterMatchExpr,
} from './malloy_types';
import {
  expressionIsAggregate,
  expressionIsAnalytic,
  expressionIsCalculation,
  expressionIsScalar,
  getIdentifier,
  hasExpression,
  isLiteral,
  isAtomic,
  isIndexSegment,
  isQuerySegment,
  isRawSegment,
  exprHasE,
  exprHasKids,
  isAsymmetricExpr,
  isSourceDef,
  fieldIsIntrinsic,
  isBaseTable,
  isJoined,
  isJoinedSource,
  isBasicArray,
  mkTemporal,
} from './malloy_types';

import type {Connection} from '../connection/types';
import type {SQLExprElement} from './utils';
import {
  AndChain,
  exprMap,
  exprWalk,
  generateHash,
  indent,
  composeSQLExpr,
  range,
} from './utils';
import {
  buildQueryMaterializationSpec,
  shouldMaterialize,
} from './materialization/utils';
import type {EventStream} from '../runtime_types';
import type {Tag} from '@malloydata/malloy-tag';
import {annotationToTag} from '../annotation';
import {FilterCompilers} from './filter_compilers';
import type {
  FilterExpression,
  FilterParserResponse,
} from '@malloydata/malloy-filter';
import {
  BooleanFilterExpression,
  NumberFilterExpression,
  StringFilterExpression,
  TemporalFilterExpression,
} from '@malloydata/malloy-filter';

interface TurtleDefPlus extends TurtleDef, Filtered {}

const NUMBER_EXPR = /^[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?$/;

function pathToCol(path: string[]): string {
  return path.map(el => encodeURIComponent(el)).join('/');
}

// quote a string for SQL use.  Perhaps should be in dialect.
function generateSQLStringLiteral(sourceString: string): string {
  return `'${sourceString}'`;
}

function identifierNormalize(s: string) {
  return s.replace(/[^a-zA-Z0-9_]/g, '_o_');
}

/** Parent from QueryStruct. */
export declare interface ParentQueryStruct {
  struct: QueryStruct;
}

/** Parent from QueryModel. */
export declare interface ParentQueryModel {
  model: QueryModel;
}

// Storage for SQL code for multi stage turtle pipelines that don't support UNNEST(ARRAY_AGG)
interface OutputPipelinedSQL {
  sqlFieldName: string;
  pipelineSQL: string;
}

function getDialectFieldList(structDef: StructDef): DialectFieldList {
  const dialectFieldList: DialectFieldList = [];

  for (const f of structDef.fields.filter(fieldIsIntrinsic)) {
    dialectFieldList.push({
      typeDef: f,
      sqlExpression: getIdentifier(f),
      rawName: getIdentifier(f),
      sqlOutputName: getIdentifier(f),
    });
  }
  return dialectFieldList;
}

interface DialectFieldArg {
  fieldDef: FieldDef;
  sqlExpression: string;
  sqlOutputName: string;
  rawName: string;
}

function pushDialectField(dl: DialectFieldList, f: DialectFieldArg) {
  const {sqlExpression, sqlOutputName, rawName} = f;
  if (isAtomic(f.fieldDef)) {
    dl.push({typeDef: f.fieldDef, sqlExpression, sqlOutputName, rawName});
  }
}

// Track the times we might need a unique key
type UniqueKeyPossibleUse =
  | AggregateFunctionType
  | 'generic_asymmetric_aggregate';

class UniqueKeyUse extends Set<UniqueKeyPossibleUse> {
  add_use(k: UniqueKeyPossibleUse | undefined) {
    if (k !== undefined) {
      return this.add(k);
    }
  }

  hasAsymetricFunctions(): boolean {
    return (
      this.has('sum') ||
      this.has('avg') ||
      this.has('count') ||
      this.has('generic_asymmetric_aggregate')
    );
  }
}

class StageWriter {
  withs: string[] = [];
  udfs: string[] = [];
  pdts: string[] = [];
  dependenciesToMaterialize: Record<string, QueryToMaterialize> = {};
  stagePrefix = '__stage';
  useCTE: boolean;

  constructor(
    useCTE = true,
    public parent: StageWriter | undefined
  ) {
    this.useCTE = useCTE;
  }

  getName(id: number) {
    return `${this.stagePrefix}${id}`;
  }

  root(): StageWriter {
    if (this.parent === undefined) {
      return this;
    } else {
      return this.parent.root();
    }
  }

  addStage(sql: string): string {
    if (this.useCTE) {
      this.withs.push(sql);
      return this.getName(this.withs.length - 1);
    } else {
      this.withs[0] = sql;
      return indent(`\n(${sql})\n`);
    }
  }

  addUDF(
    stageWriter: StageWriter,
    dialect: Dialect,
    structDef: StructDef
  ): string {
    // eslint-disable-next-line prefer-const
    let {sql, lastStageName} = stageWriter.combineStages(true);
    if (lastStageName === undefined) {
      throw new Error('Internal Error: no stage to combine');
    }
    sql += dialect.sqlCreateFunctionCombineLastStage(
      lastStageName,
      getDialectFieldList(structDef),
      (structDef.resultMetadata as ResultStructMetadataDef)?.orderBy
    );

    const id = `${dialect.udfPrefix}${this.root().udfs.length}`;
    sql = dialect.sqlCreateFunction(id, sql);
    this.root().udfs.push(sql);
    return id;
  }

  addMaterializedQuery(
    fieldName: string,
    query: Query,
    materializatedTablePrefix?: string
  ): string {
    const name = query.name;
    if (!name) {
      throw new Error(
        `Source ${fieldName} on a unnamed query that is tagged as materialize, only named queries can be materialized.`
      );
    }

    const path = query.location?.url;
    if (!path) {
      throw new Error(
        `Trying to materialize query ${name}, but its path is not set.`
      );
    }

    // Creating an object that should uniquely identify a query within a Malloy model repo.
    const queryMaterializationSpec = buildQueryMaterializationSpec(
      path,
      name,
      materializatedTablePrefix
    );
    this.root().dependenciesToMaterialize[queryMaterializationSpec.id] =
      queryMaterializationSpec;

    return queryMaterializationSpec.id;
  }

  addPDT(baseName: string, dialect: Dialect): string {
    const sql =
      this.combineStages(false).sql + this.withs[this.withs.length - 1];
    const name = baseName + generateHash(sql);
    const tableName = `scratch.${name}`;
    this.root().pdts.push(dialect.sqlCreateTableAsSelect(tableName, sql));
    return tableName;
  }

  // combine all the stages except the last one into a WITH statement
  //  return SQL and the last stage name
  combineStages(includeLastStage: boolean): {
    sql: string;
    lastStageName: string | undefined;
  } {
    if (!this.useCTE) {
      return {sql: this.withs[0], lastStageName: this.withs[0]};
    }
    let lastStageName = this.getName(0);
    let prefix = 'WITH ';
    let w = '';
    for (let i = 0; i < this.withs.length - (includeLastStage ? 0 : 1); i++) {
      const sql = this.withs[i];
      lastStageName = this.getName(i);
      if (sql === undefined) {
        throw new Error(
          `Expected sql WITH to be present for stage ${lastStageName}.`
        );
      }
      w += `${prefix}${lastStageName} AS (\n${indent(sql)})\n`;
      prefix = ', ';
    }
    return {sql: w, lastStageName};
  }

  /** emit the SQL for all the stages.  */
  generateSQLStages(): string {
    const lastStageNum = this.withs.length - 1;
    if (lastStageNum < 0) {
      throw new Error('No SQL generated');
    }
    const udfs = this.udfs.join('\n');
    const pdts = this.pdts.join('\n');
    const sql = this.combineStages(false).sql;
    return udfs + pdts + sql + this.withs[lastStageNum];
  }

  generateCoorelatedSubQuery(dialect: Dialect, structDef: StructDef): string {
    if (!this.useCTE) {
      return dialect.sqlCreateFunctionCombineLastStage(
        `(${this.withs[0]})`,
        getDialectFieldList(structDef),
        (structDef.resultMetadata as ResultStructMetadataDef)?.orderBy
      );
    } else {
      return (
        this.combineStages(true).sql +
        dialect.sqlCreateFunctionCombineLastStage(
          this.getName(this.withs.length - 1),
          getDialectFieldList(structDef),
          (structDef.resultMetadata as ResultStructMetadataDef)?.orderBy
        )
      );
    }
  }
}

class GenerateState {
  whereSQL?: string;
  applyValue?: string;
  totalGroupSet = -1;

  withWhere(s?: string): GenerateState {
    const newState = new GenerateState();
    newState.whereSQL = s;
    newState.applyValue = this.applyValue;
    newState.totalGroupSet = this.totalGroupSet;
    return newState;
  }

  withApply(s: string): GenerateState {
    const newState = new GenerateState();
    newState.whereSQL = this.whereSQL;
    newState.applyValue = s;
    newState.totalGroupSet = this.totalGroupSet;
    return newState;
  }

  withTotal(groupSet: number): GenerateState {
    const newState = new GenerateState();
    newState.whereSQL = this.whereSQL;
    newState.applyValue = this.applyValue;
    newState.totalGroupSet = groupSet;
    return newState;
  }
}

abstract class QueryNode {
  readonly referenceId: string;
  constructor(referenceId?: string) {
    this.referenceId = referenceId ?? uuidv4();
  }
  abstract getIdentifier(): string;
  getChildByName(_name: string): QueryField | undefined {
    return undefined;
  }
}

class QueryField extends QueryNode {
  fieldDef: FieldDef;
  parent: QueryStruct;

  constructor(fieldDef: FieldDef, parent: QueryStruct, referenceId?: string) {
    super(referenceId);
    this.fieldDef = fieldDef;
    this.parent = parent;
    this.fieldDef = fieldDef;
  }

  getIdentifier() {
    return getIdentifier(this.fieldDef);
  }

  uniqueKeyPossibleUse(): UniqueKeyPossibleUse | undefined {
    return undefined;
  }

  getJoinableParent(): QueryStruct {
    const parent = this.parent;
    if (parent.structDef.type === 'record') {
      return parent.getJoinableParent();
    }
    return parent;
  }

  isAtomic() {
    return isAtomic(this.fieldDef);
  }

  caseGroup(groupSets: number[], s: string): string {
    if (groupSets.length === 0) {
      return s;
    } else {
      const exp =
        groupSets.length === 1
          ? `=${groupSets[0]}`
          : ` IN (${groupSets.join(',')})`;
      return `CASE WHEN group_set${exp} THEN\n  ${s}\n  END`;
    }
  }

  getFullOutputName() {
    return this.parent.getFullOutputName() + this.getIdentifier();
  }

  generateFieldFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: FieldnameNode,
    state: GenerateState
  ): string {
    // find the structDef and return the path to the field...
    const field = context.getFieldByName(expr.path);
    if (hasExpression(field.fieldDef)) {
      const ret = this.exprToSQL(
        resultSet,
        field.parent,
        field.fieldDef.e,
        state
      );
      // in order to avoid too many parens, there was some code here ..
      // if (!ret.match(/^\(.*\)$/)) {
      //   ret = `(${ret})`;
      // }
      // but this  failed when the expresion was (bool1)or(bool2)
      // there could maybe be a smarter parse of the expression to avoid
      // an extra paren, but correctness first, beauty AND correctness later
      return `(${ret})`;
    } else {
      // return field.parent.getIdentifier() + "." + field.fieldDef.name;
      return field.generateExpression(resultSet);
    }
  }

  generateOutputFieldFragment(
    resultSet: FieldInstanceResult,
    _context: QueryStruct,
    frag: OutputFieldNode,
    _state: GenerateState
  ): string {
    return `(${resultSet.getField(frag.name).getAnalyticalSQL(false)})`;
  }

  *stringsFromSQLExpression(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    e: GenericSQLExpr,
    state: GenerateState
  ) {
    /*
     * Like template strings, the array of strings is paired with template insertions,
     * each string is followed by at most one expression to be inserted
     */
    const subExprList = [...e.kids.args];
    for (const str of e.src) {
      yield str;
      const expr = subExprList.shift();
      if (expr) {
        yield this.exprToSQL(resultSet, context, expr, state);
      }
    }
  }

  private getParameterMap(
    overload: FunctionOverloadDef,
    numArgs: number
  ): Map<string, {argIndexes: number[]; param: FunctionParameterDef}> {
    return new Map(
      overload.params.map((param, paramIndex) => {
        const argIndexes = param.isVariadic
          ? range(paramIndex, numArgs)
          : [paramIndex];
        return [param.name, {param, argIndexes}];
      })
    );
  }

  private expandFunctionCall(
    dialect: string,
    overload: FunctionOverloadDef,
    args: Expr[],
    orderBy: string | undefined,
    limit: string | undefined
  ) {
    function withCommas(es: Expr[]): SQLExprElement[] {
      const ret: SQLExprElement[] = [];
      for (let i = 0; i < es.length; ) {
        ret.push(es[i]);
        i += 1;
        if (i < es.length) {
          ret.push(',');
        }
      }
      return ret;
    }
    const paramMap = this.getParameterMap(overload, args.length);
    if (overload.dialect[dialect] === undefined) {
      throw new Error(`Function is not defined for '${dialect}' dialect`);
    }
    const expanded = exprMap(overload.dialect[dialect].e, fragment => {
      if (fragment.node === 'spread') {
        const param = fragment.e;
        if (param.node !== 'function_parameter') {
          throw new Error(
            'Invalid function definition. Argument to spread must be a function parameter.'
          );
        }
        const entry = paramMap.get(param.name);
        if (entry === undefined) {
          return fragment;
        }
        const spread = entry.argIndexes.map(argIndex => args[argIndex]);
        return composeSQLExpr(withCommas(spread));
      } else if (fragment.node === 'function_parameter') {
        const entry = paramMap.get(fragment.name);
        if (entry === undefined) {
          return fragment;
        } else if (entry.param.isVariadic) {
          const spread = entry.argIndexes.map(argIndex => args[argIndex]);
          return composeSQLExpr(withCommas(spread));
        } else {
          return args[entry.argIndexes[0]];
        }
      } else if (fragment.node === 'aggregate_order_by') {
        return orderBy
          ? composeSQLExpr([
              ` ${fragment.prefix ?? ''}${orderBy}${fragment.suffix ?? ''}`,
            ])
          : {node: ''};
      } else if (fragment.node === 'aggregate_limit') {
        return limit ? composeSQLExpr([` ${limit}`]) : {node: ''};
      }
      return fragment;
    });
    return expanded;
  }

  getFunctionOrderBy(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    state: GenerateState,
    orderBy: FunctionOrderBy[],
    args: Expr[],
    overload: FunctionOverloadDef
  ) {
    if (orderBy.length === 0) return undefined;
    return (
      'ORDER BY ' +
      orderBy
        .map(ob => {
          const defaultOrderByArgIndex =
            overload.dialect[context.dialect.name].defaultOrderByArgIndex ?? 0;
          const expr =
            ob.node === 'functionOrderBy' ? ob.e : args[defaultOrderByArgIndex];
          const osql = this.generateDimFragment(
            resultSet,
            context,
            expr,
            state
          );
          const dirsql =
            ob.dir === 'asc' ? ' ASC' : ob.dir === 'desc' ? ' DESC' : '';
          return `${osql}${dirsql}`;
        })
        .join(', ')
    );
  }

  generateAsymmetricStringAggExpression(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    value: Expr,
    separator: Expr | undefined,
    distinctKey: string,
    orderBy: FunctionOrderBy[] | undefined,
    dialectName: string,
    state: GenerateState
  ): string {
    if (orderBy) {
      throw new Error(
        `Function \`string_agg\` does not support fanning out with an order by in ${dialectName}`
      );
    }
    const valueSQL = this.generateDimFragment(resultSet, context, value, state);
    const separatorSQL = separator
      ? this.generateDimFragment(resultSet, context, separator, state)
      : '';

    return this.parent.dialect.sqlStringAggDistinct(
      distinctKey,
      valueSQL,
      separatorSQL
    );
  }

  getParamForArgIndex(params: FunctionParameterDef[], argIndex: number) {
    const prevVariadic = params.slice(0, argIndex).find(p => p.isVariadic);
    return prevVariadic ?? params[argIndex];
  }

  generateFunctionCallExpression(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    frag: FunctionCallNode,
    state: GenerateState
  ): string {
    const overload = frag.overload;
    const args = frag.kids.args;
    const isSymmetric = frag.overload.isSymmetric ?? false;
    const distinctKey =
      expressionIsAggregate(overload.returnType.expressionType) &&
      !isSymmetric &&
      this.generateDistinctKeyIfNecessary(resultSet, context, frag.structPath);

    const aggregateLimit = (() => {
      if (!frag.limit) {
        return;
      } else if (this.parent.dialect.limitClause === 'limit') {
        return `LIMIT ${frag.limit}`;
      } else if (this.parent.dialect.limitClause === 'top') {
        // It's hard to add a TOP clause here, so using offset fetch.
        return `OFFSET 0 FETCH NEXT ${frag.limit} ROWS ONLY`;
      } else {
        throw new Error(
          `limitClause ${this.parent.dialect.limitClause} not implemented`
        );
      }
    })();

    if (
      frag.name === 'string_agg' &&
      distinctKey &&
      !context.dialect.supportsAggDistinct &&
      context.dialect.name !== 'snowflake'
    ) {
      return this.generateAsymmetricStringAggExpression(
        resultSet,
        context,
        args[0],
        args[1],
        distinctKey,
        frag.kids.orderBy,
        context.dialect.name,
        state
      );
    }
    if (distinctKey) {
      if (!context.dialect.supportsAggDistinct) {
        throw new Error(
          `Function \`${frag.name}\` does not support fanning out in ${context.dialect.name}`
        );
      }
      const argsExpressions = args.map(arg => {
        return this.generateDimFragment(resultSet, context, arg, state);
      });
      const orderBys = frag.kids.orderBy ?? [];
      const orderByExpressions = orderBys.map(ob => {
        const defaultOrderByArgIndex =
          overload.dialect[context.dialect.name].defaultOrderByArgIndex ?? 0;
        const expr =
          ob.node === 'functionOrderBy' ? ob.e : args[defaultOrderByArgIndex];
        return this.generateDimFragment(resultSet, context, expr, state);
      });
      return context.dialect.sqlAggDistinct(
        distinctKey,
        [...argsExpressions, ...orderByExpressions],
        valNames => {
          const vals: Expr[] = valNames.map((v, i) => {
            // Special case: the argument is required to be literal, so we use the actual argument
            // rather than the packed value
            // TODO don't even pack the value in the first place
            if (i < args.length) {
              const param = this.getParamForArgIndex(overload.params, i);
              if (param.allowedTypes.every(t => isLiteral(t.evalSpace))) {
                return args[i];
              }
            }
            return composeSQLExpr([v]);
          });
          const newArgs = vals.slice(0, argsExpressions.length);
          const orderBy: FunctionOrderBy[] = vals
            .slice(argsExpressions.length)
            .map((e, i) => {
              return {node: 'functionOrderBy', e, dir: orderBys[i].dir};
            });
          const orderBySQL = this.getFunctionOrderBy(
            resultSet,
            context,
            state,
            orderBy,
            newArgs,
            overload
          );
          const funcCall = this.expandFunctionCall(
            context.dialect.name,
            overload,
            newArgs,
            orderBySQL,
            aggregateLimit
          );
          return this.exprToSQL(resultSet, context, funcCall, state);
        }
      );
    } else {
      const mappedArgs = expressionIsAggregate(
        overload.returnType.expressionType
      )
        ? args.map((arg, index) => {
            // TODO We assume that all arguments to this aggregate-returning function need to
            // have filters applied to them. This is not necessarily true in the general case,
            // e.g. in a function `avg_plus(a, b) = avg(a) + b` -- here, `b` should not be
            // be filtered. But since there aren't any aggregate functions like this in the
            // standard library we have planned, we ignore this for now.
            // Update: Now we apply this only to arguments whose parameter is not constant-requiring.
            // So in `string_agg(val, sep)`, `sep` does not get filters applied to it because
            // it must be constant
            const param = this.getParamForArgIndex(overload.params, index);
            // TODO technically this should probably look at _which_ allowed param type was matched
            // for this argument and see if that type is at most constant... but we lose type information
            // by this point in the compilation, so that info would have to be passed into the func call
            // fragment.
            return param.allowedTypes.every(t => isLiteral(t.evalSpace))
              ? arg
              : composeSQLExpr([
                  this.generateDimFragment(resultSet, context, arg, state),
                ]);
          })
        : args;
      const orderBySql = frag.kids.orderBy
        ? this.getFunctionOrderBy(
            resultSet,
            context,
            state,
            frag.kids.orderBy,
            args,
            overload
          )
        : '';
      const funcCall: Expr = this.expandFunctionCall(
        context.dialect.name,
        overload,
        mappedArgs,
        orderBySql,
        aggregateLimit
      );

      if (expressionIsAnalytic(overload.returnType.expressionType)) {
        const extraPartitions = (frag.partitionBy ?? []).map(outputName => {
          return `(${resultSet.getField(outputName).getAnalyticalSQL(false)})`;
        });
        return this.generateAnalyticFragment(
          context.dialect.name,
          resultSet,
          context,
          funcCall,
          overload,
          state,
          args,
          extraPartitions,
          orderBySql
        );
      }
      return this.exprToSQL(resultSet, context, funcCall, state);
    }
  }

  generateSpread(
    _resultSet: FieldInstanceResult,
    _context: QueryStruct,
    _frag: SpreadExpr,
    _state: GenerateState
  ): string {
    throw new Error('Unexpanded spread encountered during SQL generation');
  }

  generateParameterFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: ParameterNode,
    state: GenerateState
  ): string {
    const name = expr.path[0];
    context.eventStream?.emit('source-argument-compiled', {name});
    const argument = context.arguments()[name];
    if (argument.value) {
      return this.exprToSQL(resultSet, context, argument.value, state);
    }
    throw new Error(`Can't generate SQL, no value for ${expr.path}`);
  }

  generateFilterFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: FilteredExpr,
    state: GenerateState
  ): string {
    const allWhere = new AndChain(state.whereSQL);
    for (const cond of expr.kids.filterList) {
      allWhere.add(
        this.exprToSQL(resultSet, context, cond.e, state.withWhere())
      );
    }
    return this.exprToSQL(
      resultSet,
      context,
      expr.kids.e,
      state.withWhere(allWhere.sql())
    );
  }

  generateDimFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: Expr,
    state: GenerateState
  ): string {
    let dim = this.exprToSQL(resultSet, context, expr, state);
    if (state.whereSQL) {
      dim = `CASE WHEN ${state.whereSQL} THEN ${dim} END`;
    }
    return dim;
  }

  generateUngroupedFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: UngroupNode,
    state: GenerateState
  ): string {
    if (state.totalGroupSet !== -1) {
      throw new Error('Already in ALL.  Cannot nest within an all calcuation.');
    }

    let totalGroupSet;
    let ungroupSet: UngroupSet | undefined;

    if (expr.fields && expr.fields.length > 0) {
      const key = expr.fields.sort().join('|') + expr.node;
      ungroupSet = resultSet.ungroupedSets.get(key);
      if (ungroupSet === undefined) {
        throw new Error(`Internal Error, cannot find groupset with key ${key}`);
      }
      totalGroupSet = ungroupSet.groupSet;
    } else {
      totalGroupSet = resultSet.parent ? resultSet.parent.groupSet : 0;
    }

    const s = this.exprToSQL(
      resultSet,
      context,
      expr.e,
      state.withTotal(totalGroupSet)
    );

    const fields = resultSet.getUngroupPartitions(ungroupSet);

    let partitionBy = '';
    const fieldsString = fields.map(f => f.getAnalyticalSQL(true)).join(', ');
    if (fieldsString.length > 0) {
      partitionBy = `PARTITION BY ${fieldsString}`;
    }
    return `MAX(${s}) OVER (${partitionBy})`;
  }

  generateDistinctKeyIfNecessary(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    structPath: string[] | undefined
  ): string | undefined {
    let struct = context;
    if (structPath) {
      struct = this.parent.root().getStructByName(structPath);
    }
    if (struct.needsSymetricCalculation(resultSet)) {
      return struct.getDistinctKey().generateExpression(resultSet);
    } else {
      return undefined;
    }
  }

  generateSumFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: AggregateExpr,
    state: GenerateState
  ): string {
    const dimSQL = this.generateDimFragment(resultSet, context, expr.e, state);
    const distinctKeySQL = this.generateDistinctKeyIfNecessary(
      resultSet,
      context,
      expr.structPath
    );
    let ret;
    if (distinctKeySQL) {
      if (this.parent.dialect.supportsSumDistinctFunction) {
        ret = this.parent.dialect.sqlSumDistinct(distinctKeySQL, dimSQL, 'SUM');
      } else {
        ret = sqlSumDistinct(this.parent.dialect, dimSQL, distinctKeySQL);
      }
    } else {
      ret = `SUM(${dimSQL})`;
    }
    return `COALESCE(${ret},0)`;
  }

  generateSymmetricFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: AggregateExpr,
    state: GenerateState
  ): string {
    const dimSQL = this.generateDimFragment(resultSet, context, expr.e, state);
    const f =
      expr.function === 'distinct' ? 'count(distinct ' : expr.function + '(';
    return `${f}${dimSQL})`;
  }

  generateAvgFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: AggregateExpr,
    state: GenerateState
  ): string {
    // find the structDef and return the path to the field...
    const dimSQL = this.generateDimFragment(resultSet, context, expr.e, state);
    const distinctKeySQL = this.generateDistinctKeyIfNecessary(
      resultSet,
      context,
      expr.structPath
    );
    if (distinctKeySQL) {
      let countDistinctKeySQL = distinctKeySQL;
      if (state.whereSQL) {
        countDistinctKeySQL = `CASE WHEN ${state.whereSQL} THEN ${distinctKeySQL} END`;
      }
      let sumDistinctSQL;
      let avgDistinctSQL;
      if (this.parent.dialect.supportsSumDistinctFunction) {
        avgDistinctSQL = this.parent.dialect.sqlSumDistinct(
          distinctKeySQL,
          dimSQL,
          'AVG'
        );
      } else {
        sumDistinctSQL = sqlSumDistinct(
          this.parent.dialect,
          dimSQL,
          distinctKeySQL
        );
        avgDistinctSQL = `(${sumDistinctSQL})/NULLIF(COUNT(DISTINCT CASE WHEN ${dimSQL} IS NOT NULL THEN ${countDistinctKeySQL} END),0)`;
      }
      return avgDistinctSQL;
    } else {
      return `AVG(${dimSQL})`;
    }
  }

  generateCountFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: AggregateExpr,
    state: GenerateState
  ): string {
    let func = 'COUNT(';
    let thing = '1';

    let struct = context;
    if (expr.structPath) {
      struct = this.parent.root().getStructByName(expr.structPath);
    }
    const joinName = struct.getJoinableParent().getIdentifier();
    const join = resultSet.root().joins.get(joinName);
    if (!join) {
      throw new Error(`Join ${joinName} not found in result set`);
    }
    if (!join.leafiest || join.makeUniqueKey) {
      func = 'COUNT(DISTINCT ';
      thing = struct.getDistinctKey().generateExpression(resultSet);
    }

    // const distinctKeySQL = this.generateDistinctKeyIfNecessary(
    //   resultSet,
    //   context,
    //   expr.structPath
    // );
    // if (distinctKeySQL) {
    //   func = 'COUNT(DISTINCT';
    //   thing = distinctKeySQL;
    // }

    // find the structDef and return the path to the field...
    if (state.whereSQL) {
      return `${func}CASE WHEN ${state.whereSQL} THEN ${thing} END)`;
    } else {
      return `${func}${thing})`;
    }
  }

  generateSourceReference(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: SourceReferenceNode
  ): string {
    if (expr.path === undefined) {
      return context.getSQLIdentifier();
    } else {
      return context.getFieldByName(expr.path).getIdentifier();
    }
  }

  getAnalyticPartitions(
    resultStruct: FieldInstanceResult,
    extraPartitionFields?: string[]
  ): string[] {
    const ret: string[] = [];
    let p = resultStruct.parent;
    while (p !== undefined) {
      const scalars = p.fields(
        fi => isBasicScalar(fi.f) && fi.fieldUsage.type === 'result'
      );
      const partitionSQLs = scalars.map(fi => fi.getAnalyticalSQL(true));
      ret.push(...partitionSQLs);
      p = p.parent;
    }
    if (extraPartitionFields) {
      ret.push(...extraPartitionFields);
    }
    return ret;
  }

  generateAnalyticFragment(
    dialect: string,
    resultStruct: FieldInstanceResult,
    context: QueryStruct,
    expr: Expr,
    overload: FunctionOverloadDef,
    state: GenerateState,
    args: Expr[],
    partitionByFields?: string[],
    funcOrdering?: string
  ): string {
    const isComplex = resultStruct.root().isComplexQuery;
    const partitionFields = this.getAnalyticPartitions(
      resultStruct,
      partitionByFields
    );
    const allPartitions = [
      ...(isComplex ? ['group_set'] : []),
      ...partitionFields,
    ];
    const partitionBy =
      allPartitions.length > 0
        ? `PARTITION BY ${allPartitions.join(', ')}`
        : '';

    let orderBy = funcOrdering ?? '';
    const dialectOverload = overload.dialect[dialect];
    if (!funcOrdering && dialectOverload.needsWindowOrderBy) {
      // calculate the ordering.
      const obSQL: string[] = [];
      let orderingField;
      const orderByDef =
        (resultStruct.firstSegment as QuerySegment).orderBy ||
        resultStruct.calculateDefaultOrderBy();
      for (const ordering of orderByDef) {
        if (typeof ordering.field === 'string') {
          orderingField = {
            name: ordering.field,
            fif: resultStruct.getField(ordering.field),
          };
        } else {
          orderingField = resultStruct.getFieldByNumber(ordering.field);
        }
        const exprType = orderingField.fif.f.fieldDef.expressionType;
        // TODO today we do not support ordering by analytic functions at all, so this works
        // but eventually we will, and this check will just want to ensure that the order field
        // isn't the same as the field we're currently compiling (otherwise we will loop infintely)
        if (expressionIsAnalytic(exprType)) {
          continue;
        }
        if (resultStruct.firstSegment.type === 'reduce') {
          const orderSQL = orderingField.fif.getAnalyticalSQL(false);
          // const orderSQL = this.generateDimFragment(resultSet, context, arg, state)
          obSQL.push(` ${orderSQL} ${ordering.dir || 'ASC'}`);
        } else if (resultStruct.firstSegment.type === 'project') {
          obSQL.push(
            ` ${orderingField.fif.f.generateExpression(resultStruct)} ${
              ordering.dir || 'ASC'
            }`
          );
        }
      }

      if (obSQL.length > 0) {
        orderBy = ' ' + this.parent.dialect.sqlOrderBy(obSQL, 'analytical');
      }
    }

    let between = '';
    if (dialectOverload.between) {
      const [preceding, following] = [
        dialectOverload.between.preceding,
        dialectOverload.between.following,
      ].map(value => {
        if (value === -1) {
          return 'UNBOUNDED';
        }
        if (typeof value === 'number') {
          return value;
        }
        const argIndex = overload.params.findIndex(
          param => param.name === value
        );
        const arg = args[argIndex];
        if (arg.node !== 'numberLiteral') {
          throw new Error('Invalid number of rows for window spec');
        }
        // TODO this does not handle float literals correctly
        return arg.literal;
      });
      between = `ROWS BETWEEN ${preceding} PRECEDING AND ${following} FOLLOWING`;
    }

    const funcSQL = this.exprToSQL(resultStruct, context, expr, state);

    let retExpr = `${funcSQL} OVER(${partitionBy} ${orderBy} ${between})`;
    if (isComplex) {
      retExpr = `CASE WHEN group_set=${resultStruct.groupSet} THEN ${retExpr} END`;
    }
    return retExpr;
  }

  generateCaseSQL(pf: CaseExpr): string {
    const caseStmt = ['CASE'];
    if (pf.kids.caseValue !== undefined) {
      caseStmt.push(`${pf.kids.caseValue.sql}`);
    }
    for (let i = 0; i < pf.kids.caseWhen.length; i += 1) {
      caseStmt.push(
        `WHEN ${pf.kids.caseWhen[i].sql} THEN ${pf.kids.caseThen[i].sql}`
      );
    }
    if (pf.kids.caseElse !== undefined) {
      caseStmt.push(`ELSE ${pf.kids.caseElse.sql}`);
    }
    caseStmt.push('END');
    return caseStmt.join(' ');
  }

  exprToSQL(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    exprToTranslate: Expr,
    state: GenerateState = new GenerateState()
  ): string {
    // Wrap non leaf sub expressions in parenthesis
    const subExpr = function (qf: QueryField, e: Expr) {
      const sql = qf.exprToSQL(resultSet, context, e, state);
      if (exprHasKids(e)) {
        return `(${sql})`;
      }
      return sql;
    };

    /*
     * Translate the children first, and stash the translation
     * in the nodes themselves, so that if we call into the dialect
     * it will have access to the translated children.
     */
    let expr = exprToTranslate;
    if (exprHasE(exprToTranslate)) {
      expr = {...exprToTranslate};
      const eSql = subExpr(this, expr.e);
      expr.e = {...expr.e, sql: eSql};
    } else if (exprHasKids(exprToTranslate)) {
      expr = {...exprToTranslate};
      const oldKids = exprToTranslate.kids;
      for (const [name, kidExpr] of Object.entries(oldKids)) {
        if (kidExpr === null) continue;
        if (Array.isArray(kidExpr)) {
          expr.kids[name] = kidExpr.map(e => {
            return {...e, sql: subExpr(this, e)};
          });
        } else {
          expr.kids[name] = {...oldKids[name], sql: subExpr(this, kidExpr)};
        }
      }
    }

    /*
     * Give the dialect a chance to translate this node
     */
    const qi = resultSet.getQueryInfo();
    const dialectSQL = this.parent.dialect.exprToSQL(qi, expr);
    if (dialectSQL) {
      return dialectSQL;
    }

    switch (expr.node) {
      case 'field':
        return this.generateFieldFragment(resultSet, context, expr, state);
      case 'parameter':
        return this.generateParameterFragment(resultSet, context, expr, state);
      case 'filteredExpr':
        return this.generateFilterFragment(resultSet, context, expr, state);
      case 'all':
      case 'exclude':
        return this.generateUngroupedFragment(resultSet, context, expr, state);
      case 'genericSQLExpr':
        return Array.from(
          this.stringsFromSQLExpression(resultSet, context, expr, state)
        ).join('');
      case 'aggregate': {
        let agg = '';
        if (expr.function === 'sum') {
          agg = this.generateSumFragment(resultSet, context, expr, state);
        } else if (expr.function === 'avg') {
          agg = this.generateAvgFragment(resultSet, context, expr, state);
        } else if (expr.function === 'count') {
          agg = this.generateCountFragment(resultSet, context, expr, state);
        } else if (
          expr.function === 'min' ||
          expr.function === 'max' ||
          expr.function === 'distinct'
        ) {
          agg = this.generateSymmetricFragment(resultSet, context, expr, state);
        } else {
          throw new Error(
            `Internal Error: Unknown aggregate function ${expr.function}`
          );
        }
        if (resultSet.root().isComplexQuery) {
          let groupSet = resultSet.groupSet;
          if (state.totalGroupSet !== -1) {
            groupSet = state.totalGroupSet;
          }
          return this.caseGroup([groupSet], agg);
        }
        return agg;
      }
      case 'function_parameter':
        throw new Error(
          'Internal Error: Function parameter fragment remaining during SQL generation'
        );
      case 'outputField':
        return this.generateOutputFieldFragment(
          resultSet,
          context,
          expr,
          state
        );
      case 'function_call':
        return this.generateFunctionCallExpression(
          resultSet,
          context,
          expr,
          state
        );
      case 'spread':
        return this.generateSpread(resultSet, context, expr, state);
      case 'source-reference':
        return this.generateSourceReference(resultSet, context, expr);
      case '+':
      case '-':
      case '*':
      case '%':
      case '/':
      case '>':
      case '<':
      case '>=':
      case '<=':
      case '=':
        return `${expr.kids.left.sql}${expr.node}${expr.kids.right.sql}`;
      // Malloy inequality comparisons always return a boolean
      case '!=': {
        const notEqual = `${expr.kids.left.sql}!=${expr.kids.right.sql}`;
        return `COALESCE(${notEqual},true)`;
      }
      case 'and':
      case 'or':
        return `${expr.kids.left.sql} ${expr.node} ${expr.kids.right.sql}`;
      case 'coalesce':
        return `COALESCE(${expr.kids.left.sql},${expr.kids.right.sql})`;
      case 'in': {
        const oneOf = expr.kids.oneOf.map(o => o.sql).join(',');
        return `${expr.kids.e.sql} ${expr.not ? 'NOT IN' : 'IN'} (${oneOf})`;
      }
      case 'like':
      case '!like': {
        const likeIt = expr.node === 'like' ? 'LIKE' : 'NOT LIKE';
        const compare =
          expr.kids.right.node === 'stringLiteral'
            ? this.parent.dialect.sqlLike(
                likeIt,
                expr.kids.left.sql ?? '',
                expr.kids.right.literal
              )
            : `${expr.kids.left.sql} ${likeIt} ${expr.kids.right.sql}`;
        return expr.node === 'like' ? compare : `COALESCE(${compare},true)`;
      }
      case '()':
        return `(${expr.e.sql})`;
      case 'not':
        // TODO (vitor): Is the following comment still true?
        // Malloy not operator always returns a boolean
        return `COALESCE(NOT ${expr.e.sql},TRUE)`;
      case 'unary-':
        return `-${expr.e.sql}`;
      case 'is-null':
        return `${expr.e.sql} IS NULL`;
      case 'is-not-null':
        return `${expr.e.sql} IS NOT NULL`;
      case 'true':
      case 'false':
        return expr.node;
      case 'null':
        return 'NULL';
      case 'case':
        return this.generateCaseSQL(expr);
      case '':
        return '';
      case 'filterCondition':
        // our child will be translated at the top of this function
        if (expr.e.sql) {
          expr.sql = expr.e.sql;
          return expr.sql;
        }
        return '';
      case 'functionDefaultOrderBy':
      case 'functionOrderBy':
        return '';
      // TODO: throw an error here; not simple because we call into this
      // code currently before the composite source is resolved in some cases
      case 'compositeField':
        return '{COMPOSITE_FIELD}';
      case 'filterMatch':
        return this.generateAppliedFilter(context, expr);
      case 'filterLiteral':
        return 'INTERNAL ERROR FILTER EXPRESSION VALUE SHOULD NOT BE USED';
      default:
        throw new Error(
          `Internal Error: Unknown expression node '${
            expr.node
          }' ${JSON.stringify(expr, undefined, 2)}`
        );
    }
  }

  generateAppliedFilter(
    context: QueryStruct,
    filterMatchExpr: FilterMatchExpr
  ): string {
    let filterExpr = filterMatchExpr.kids.filterExpr;
    while (filterExpr.node === '()') {
      filterExpr = filterExpr.e;
    }
    if (filterExpr.node === 'parameter') {
      const name = filterExpr.path[0];
      context.eventStream?.emit('source-argument-compiled', {name});
      const argument = context.arguments()[name];
      if (argument.value) {
        filterExpr = argument.value;
      } else {
        throw new Error(
          `Parameter ${name} was expected to be a filter expression`
        );
      }
    }
    if (filterExpr.node !== 'filterLiteral') {
      throw new Error(
        'Can only use filter expression literals or parameters as filter expressions'
      );
    }
    const filterSrc = filterExpr.filterSrc;
    let fParse: FilterParserResponse<FilterExpression>;
    switch (filterMatchExpr.dataType) {
      case 'string':
        fParse = StringFilterExpression.parse(filterSrc);
        break;
      case 'number':
        fParse = NumberFilterExpression.parse(filterSrc);
        break;
      case 'boolean':
        fParse = BooleanFilterExpression.parse(filterSrc);
        break;
      case 'date':
      case 'timestamp':
        fParse = TemporalFilterExpression.parse(filterSrc);
        break;
    }

    if (fParse.log.length > 0) {
      throw new Error(`Filter expression parse error: ${fParse.log[0]}`);
    }

    return FilterCompilers.compile(
      filterMatchExpr.dataType,
      fParse.parsed,
      filterMatchExpr.kids.expr.sql || '',
      context.dialect
    );
  }

  isNestedInParent(parentDef: FieldDef) {
    switch (parentDef.type) {
      case 'record':
      case 'array':
        return true;
        return true;
      default:
        return false;
    }
  }

  isArrayElement(parentDef: FieldDef) {
    return (
      parentDef.type === 'array' &&
      parentDef.elementTypeDef.type !== 'record_element'
    );
  }

  generateExpression(resultSet: FieldInstanceResult): string {
    // If the field itself is an expression, generate it ..
    if (hasExpression(this.fieldDef)) {
      return this.exprToSQL(resultSet, this.parent, this.fieldDef.e);
    }
    // The field itself is not an expression, so we would like
    // to generate a dotted path to the field, EXCEPT ...
    // some of the steps in the dotting might not exist
    // in the namespace of their parent, but rather be record
    // expressions which should be evaluated in the namespace
    // of their parent.

    // So we walk the tree and ask each one to compute itself
    for (
      let ancestor: QueryStruct | undefined = this.parent;
      ancestor !== undefined;
      ancestor = ancestor.parent
    ) {
      if (
        ancestor.structDef.type === 'record' &&
        hasExpression(ancestor.structDef) &&
        ancestor.recordAlias === undefined
      ) {
        if (!ancestor.parent) {
          throw new Error(
            'Inconcievable record ancestor with expression but no parent'
          );
        }
        const aliasValue = this.exprToSQL(
          resultSet,
          ancestor.parent,
          ancestor.structDef.e
        );
        ancestor.informOfAliasValue(aliasValue);
      }
    }
    return this.parent.sqlChildReference(
      this.fieldDef.name,
      this.parent.structDef.type === 'record'
        ? {
            result: resultSet,
            field: this,
          }
        : undefined
    );
  }

  includeInWildcard() {
    return false;
  }
}

function isBasicCalculation(f: QueryField): f is QueryBasicField {
  return f instanceof QueryAtomicField && isCalculatedField(f);
}

function isBasicAggregate(f: QueryField): f is QueryBasicField {
  return f instanceof QueryAtomicField && isAggregateField(f);
}

function isBasicScalar(f: QueryField): f is QueryBasicField {
  return f instanceof QueryAtomicField && isScalarField(f);
}

function isScalarField(f: QueryField) {
  if (f.isAtomic()) {
    if (hasExpression(f.fieldDef)) {
      const et = f.fieldDef.expressionType;
      if (expressionIsCalculation(et) || expressionIsAggregate(et)) {
        return false;
      }
    }
    return true;
  }
  return false;
}

function isCalculatedField(f: QueryField) {
  if (f.isAtomic() && hasExpression(f.fieldDef)) {
    return expressionIsCalculation(f.fieldDef.expressionType);
  }
  return false;
}

function isAggregateField(f: QueryField) {
  if (f.isAtomic() && hasExpression(f.fieldDef)) {
    return expressionIsAggregate(f.fieldDef.expressionType);
  }
  return false;
}

/*
 * When compound (arrays, records) types became atomic types, it became unclear
 * which code wanted just "numbers and strings" and which code wanted anything
 * atomic.
 *
 * All of the original QueryFields are now members of "QueryBasicField"
 *
 * I think the re-factor for adding atomic compound types isn't done yet,
 * but things are working well enough now. A bug with nesting repeated
 * records revealed the need for isScalarField, but I was not brave
 * enough to look at all the calls is isBasicScalar.
 */
type QueryBasicField = QueryAtomicField<BasicAtomicDef>;
abstract class QueryAtomicField<T extends AtomicFieldDef> extends QueryField {
  fieldDef: T;

  constructor(fieldDef: T, parent: QueryStruct, refId?: string) {
    super(fieldDef, parent, refId);
    this.fieldDef = fieldDef; // wish I didn't have to do this
  }

  includeInWildcard(): boolean {
    return true;
  }

  getFilterList(): FilterCondition[] {
    return [];
  }
}

// class QueryMeasure extends QueryField {}

class QueryFieldString extends QueryAtomicField<StringFieldDef> {}
class QueryFieldNumber extends QueryAtomicField<NumberFieldDef> {}
class QueryFieldBoolean extends QueryAtomicField<BooleanFieldDef> {}
class QueryFieldJSON extends QueryAtomicField<JSONFieldDef> {}
class QueryFieldUnsupported extends QueryAtomicField<NativeUnsupportedFieldDef> {}

class QueryFieldDate extends QueryAtomicField<DateFieldDef> {
  generateExpression(resultSet: FieldInstanceResult): string {
    const fd = this.fieldDef;
    const superExpr = super.generateExpression(resultSet);
    if (!fd.timeframe) {
      return superExpr;
    } else {
      const truncated: TimeTruncExpr = {
        node: 'trunc',
        e: mkTemporal(
          {node: 'genericSQLExpr', src: [superExpr], kids: {args: []}},
          'date'
        ),
        units: fd.timeframe,
      };
      return this.exprToSQL(resultSet, this.parent, truncated);
    }
  }

  // clone ourselves on demand as a timeframe.
  getChildByName(name: DateUnit): QueryFieldDate {
    const fieldDef: DateFieldDef = {
      ...this.fieldDef,
      as: `${this.getIdentifier()}_${name}`,
      timeframe: name,
    };
    return new QueryFieldDate(fieldDef, this.parent);
  }
}

class QueryFieldTimestamp extends QueryAtomicField<TimestampFieldDef> {
  // clone ourselves on demand as a timeframe.
  getChildByName(name: TimestampUnit): QueryFieldTimestamp {
    const fieldDef = {
      ...this.fieldDef,
      as: `${this.getIdentifier()}_${name}`,
      timeframe: name,
    };
    return new QueryFieldTimestamp(fieldDef, this.parent);
  }
}

class QueryFieldDistinctKey extends QueryAtomicField<StringFieldDef> {
  generateExpression(resultSet: FieldInstanceResult): string {
    if (this.parent.primaryKey()) {
      const pk = this.parent.getPrimaryKeyField(this.fieldDef);
      return pk.generateExpression(resultSet);
    } else if (this.parent.structDef.type === 'array') {
      const parentKey = this.parent.parent
        ?.getDistinctKey()
        .generateExpression(resultSet);
      return this.parent.dialect.sqlMakeUnnestKey(
        parentKey || '', // shouldn't have to do this...
        this.parent.dialect.sqlFieldReference(
          this.parent.getIdentifier(),
          'table',
          '__row_id',
          'string'
        )
      );
    } else {
      // return this.parent.getIdentifier() + "." + "__distinct_key";
      return this.parent.dialect.sqlFieldReference(
        this.parent.getIdentifier(),
        'table',
        '__distinct_key',
        'string'
      );
    }
  }

  includeInWildcard(): boolean {
    return false;
  }
}

const NUMERIC_DECIMAL_PRECISION = 9;

function sqlSumDistinct(
  dialect: Dialect,
  sqlExp: string,
  sqlDistintKey: string
) {
  const precision = 9;
  const uniqueInt = dialect.sqlSumDistinctHashedKey(sqlDistintKey);
  const multiplier = 10 ** (precision - NUMERIC_DECIMAL_PRECISION);
  const sumSQL = `
  (
    SUM(DISTINCT
      (CAST(ROUND(COALESCE(${sqlExp},0)*(${multiplier}*1.0), ${NUMERIC_DECIMAL_PRECISION}) AS ${dialect.defaultDecimalType}) +
      ${uniqueInt}
    ))
    -
     SUM(DISTINCT ${uniqueInt})
  )`;
  let ret = `(${sumSQL}/(${multiplier}*1.0))`;
  ret = `CAST(${ret} AS ${dialect.defaultNumberType})`;
  return ret;
}

type FieldUsage =
  | {
      type: 'result';
      resultIndex: number;
    }
  | {type: 'where'}
  | {type: 'dependant'};

type FieldInstanceType = 'field' | 'query';

interface FieldInstance {
  type: FieldInstanceType;
  // groupSet: number;
  root(): FieldInstanceResultRoot;
}

class FieldInstanceField implements FieldInstance {
  type: FieldInstanceType = 'field';
  additionalGroupSets: number[] = [];
  analyticalSQL: string | undefined; // the name of the field when used in a window function calculation.
  partitionSQL: string | undefined; // the name of the field when used as a partition.
  constructor(
    public f: QueryField,
    public fieldUsage: FieldUsage,
    public parent: FieldInstanceResult
  ) {}

  root(): FieldInstanceResultRoot {
    return this.parent.root();
  }

  getSQL() {
    let exp = this.f.generateExpression(this.parent);
    if (isScalarField(this.f)) {
      exp = this.f.caseGroup(
        this.parent.groupSet > 0
          ? this.parent.childGroups.concat(this.additionalGroupSets)
          : [],
        exp
      );
    }
    return exp;
  }

  getAnalyticalSQL(forPartition: boolean): string {
    if (this.analyticalSQL === undefined) {
      return this.getSQL();
    } else if (forPartition && this.partitionSQL) {
      return this.partitionSQL;
    } else {
      return this.analyticalSQL;
    }
  }
}

type RepeatedResultType = 'nested' | 'inline_all_numbers' | 'inline';

type UngroupSet = {
  type: 'all' | 'exclude';
  fields: string[];
  groupSet: number;
};

class FieldInstanceResult implements FieldInstance {
  type: FieldInstanceType = 'query';
  allFields = new Map<string, FieldInstance>();
  groupSet = 0;
  depth = 0;
  childGroups: number[] = [];
  firstSegment: PipeSegment;
  hasHaving = false;
  ungroupedSets = new Map<string, UngroupSet>();
  // query: QueryQuery;

  resultUsesUngrouped = false;

  constructor(
    public turtleDef: TurtleDef,
    public parent: FieldInstanceResult | undefined
  ) {
    this.firstSegment = turtleDef.pipeline[0];
  }

  /**
   * Information about the query containing this result set. Invented
   * to pass on timezone information, but maybe more things will
   * eventually go in here.
   * @returns QueryInfo
   */
  getQueryInfo(): QueryInfo {
    if (
      !isIndexSegment(this.firstSegment) &&
      !isRawSegment(this.firstSegment)
    ) {
      const {queryTimezone} = this.firstSegment;
      if (queryTimezone) {
        return {queryTimezone};
      }
    }
    return {};
  }

  addField(as: string, field: QueryField, usage: FieldUsage) {
    const fi = this.allFields.get(as);
    if (fi) {
      if (fi.type === 'query') {
        throw new Error(
          `Redefinition of field ${field.fieldDef.name} as struct`
        );
      }
      const fif = fi as FieldInstanceField;
      if (fif.fieldUsage.type === 'result') {
        if (usage.type !== 'result') {
          // its already in the result, we can just ignore it.
          return;
        } else {
          throw new Error(
            `Ambiguous output field name '${field.fieldDef.name}'.`
          );
        }
      }
    }
    this.add(as, new FieldInstanceField(field, usage, this));
  }

  parentGroupSet(): number {
    if (this.parent) {
      return this.parent.groupSet;
    } else {
      return 0;
    }
  }

  add(name: string, f: FieldInstance) {
    this.allFields.set(name, f);
  }

  hasField(name: string): boolean {
    const fi = this.allFields.get(name);
    return fi !== undefined && fi instanceof FieldInstanceField;
  }

  getField(name: string): FieldInstanceField {
    const fi = this.allFields.get(name);
    if (fi === undefined) {
      throw new Error(`Internal Error, field Not defined ${name}`);
    } else if (fi instanceof FieldInstanceField) {
      return fi;
    }
    throw new Error(`can't use a query here ${name}`);
  }

  getFieldByNumber(index: number): {name: string; fif: FieldInstanceField} {
    for (const [name, fi] of this.allFields) {
      if (fi instanceof FieldInstanceField) {
        if (
          fi.fieldUsage.type === 'result' &&
          fi.fieldUsage.resultIndex === index
        ) {
          return {name, fif: fi};
        }
      }
    }
    throw new Error(`Invalid Order By index '${index}`);
  }

  // loops through all the turtled queries and computes recomputes the group numbers
  computeGroups(
    nextGroupSetNumber: number,
    depth: number
  ): {
    nextGroupSetNumber: number;
    maxDepth: number;
    children: number[];
    isComplex: boolean;
  } {
    // if the root node uses a total, start at 1.
    if (nextGroupSetNumber === 0 && this.resultUsesUngrouped) {
      this.root().computeOnlyGroups.push(nextGroupSetNumber++);
    }

    // make a groupset for each unique ungrouping expression
    for (const [_key, grouping] of this.ungroupedSets) {
      const groupSet = nextGroupSetNumber++;
      grouping.groupSet = groupSet;
      this.root().computeOnlyGroups.push(groupSet);
    }

    this.groupSet = nextGroupSetNumber++;
    this.depth = depth;
    let maxDepth = depth;
    let isComplex = false;
    let children: number[] = [this.groupSet];
    for (const [_name, fi] of this.allFields) {
      if (fi.type === 'query') {
        const fir = fi as FieldInstanceResult;
        isComplex = true;
        if (fir.firstSegment.type === 'reduce') {
          const r = fir.computeGroups(nextGroupSetNumber, depth + 1);
          children = children.concat(r.children);
          nextGroupSetNumber = r.nextGroupSetNumber;
          if (r.maxDepth > maxDepth) {
            maxDepth = r.maxDepth;
          }
        }
      }
    }
    this.childGroups = children;
    return {nextGroupSetNumber, maxDepth, children, isComplex};
  }

  fields(
    fn: undefined | ((field: FieldInstanceField) => boolean) = undefined
  ): FieldInstanceField[] {
    const ret: FieldInstanceField[] = [];
    for (const e of this.allFields.values()) {
      if (e instanceof FieldInstanceField) {
        if (fn === undefined || fn(e)) {
          ret.push(e);
        }
      }
    }
    return ret;
  }

  fieldNames(
    fn: undefined | ((field: FieldInstanceField) => boolean)
  ): string[] {
    const ret: string[] = [];
    for (const [name, fi] of this.allFields) {
      if (fi instanceof FieldInstanceField) {
        if (fn === undefined || fn(fi)) {
          ret.push(name);
        }
      }
    }
    return ret;
  }

  // if a turtled result is all measures, we emit use ANY_VALUE for the aggregation
  //  and emit the resulting structure as a RECORD instead of REPEATED
  //  if we have all numbers, we need to know because we'll have to conjur a record.
  getRepeatedResultType(): RepeatedResultType {
    let ret: RepeatedResultType = 'inline_all_numbers';
    for (const f of this.fields()) {
      if (f.fieldUsage.type === 'result') {
        if (isBasicScalar(f.f)) {
          return 'nested';
        }
        if (f.f instanceof QueryFieldStruct) {
          ret = 'inline';
        }
      }
    }
    return ret;
  }

  structs(): FieldInstanceResult[] {
    const ret: FieldInstanceResult[] = [];
    for (const e of this.allFields.values()) {
      if (e instanceof FieldInstanceResult) {
        ret.push(e);
      }
    }
    return ret;
  }

  // return a list of structs that match the criteria
  //  specified in the function.
  selectStructs(
    result: FieldInstanceResult[],
    fn: (result: FieldInstanceResult) => boolean
  ): FieldInstanceResult[] {
    if (fn(this)) {
      result.push(this);
    }
    for (const e of this.structs()) {
      e.selectStructs(result, fn);
    }
    return result;
  }

  calculateDefaultOrderBy(): OrderBy[] {
    // LookML rules for default ordering.
    //  Date or time  or ordnal based fields, that field ascending
    //  First Measure Descending.
    let firstField;
    for (const [_name, fi] of this.allFields) {
      if (fi instanceof FieldInstanceField) {
        if (fi.fieldUsage.type === 'result') {
          if (
            fi.f.fieldDef.type === 'turtle' ||
            isJoined(fi.f.fieldDef) ||
            expressionIsAnalytic(fi.f.fieldDef.expressionType)
          ) {
            continue;
          }
          firstField ||= fi.fieldUsage.resultIndex;
          if (['date', 'timestamp'].indexOf(fi.f.fieldDef.type) > -1) {
            return [{dir: 'desc', field: fi.fieldUsage.resultIndex}];
          } else if (isBasicAggregate(fi.f)) {
            return [{dir: 'desc', field: fi.fieldUsage.resultIndex}];
          }
        }
      }
    }
    if (firstField) {
      return [{dir: 'asc', field: firstField}];
    }
    return [];
  }

  addStructToJoin(
    qs: QueryStruct,
    query: QueryQuery,
    uniqueKeyPossibleUse: UniqueKeyPossibleUse | undefined,
    joinStack: string[]
  ): void {
    const name = qs.getIdentifier();

    // we're already chasing the dependency for this join.
    if (joinStack.indexOf(name) !== -1) {
      return;
    }

    let join: JoinInstance | undefined;
    if ((join = this.root().joins.get(name))) {
      join.uniqueKeyPossibleUses.add_use(uniqueKeyPossibleUse);
      return;
    }

    // if we have a parent, join it first.
    let parent: JoinInstance | undefined;
    const parentStruct = qs.parent?.getJoinableParent();
    if (parentStruct) {
      // add dependant expressions first...
      this.addStructToJoin(parentStruct, query, undefined, joinStack);
      parent = this.root().joins.get(parentStruct.getIdentifier());
    }

    // add any dependant joins based on the ON
    const sd = qs.structDef;
    if (
      isJoinedSource(sd) &&
      qs.parent && // if the join has an ON, it must thave a parent
      sd.onExpression &&
      joinStack.indexOf(name) === -1
    ) {
      query.addDependantExpr(this, qs.parent, sd.onExpression, [
        ...joinStack,
        name,
      ]);
    }

    if (!(join = this.root().joins.get(name))) {
      join = new JoinInstance(qs, name, parent);
      this.root().joins.set(name, join);
    }
    join.uniqueKeyPossibleUses.add_use(uniqueKeyPossibleUse);
  }

  findJoins(query: QueryQuery) {
    for (const dim of this.fields()) {
      if (!(dim.f instanceof QueryFieldStruct)) {
        this.addStructToJoin(
          dim.f.getJoinableParent(),
          query,
          dim.f.uniqueKeyPossibleUse(),
          []
        );
      }
    }
    for (const s of this.structs()) {
      s.findJoins(query);
    }
  }

  root(): FieldInstanceResultRoot {
    if (this.parent) {
      return this.parent.root();
    }
    throw new Error('Internal Error, Null parent FieldInstanceResult');
  }

  getUngroupPartitions(
    ungroupSet: UngroupSet | undefined
  ): FieldInstanceField[] {
    let ret: FieldInstanceField[] = [];

    let p: FieldInstanceResult | undefined = this as FieldInstanceResult;
    let excludeFields: string[] = [];
    let inScopeFieldNames: string[] = [];
    // all defaults to all fields at the current level.
    if (ungroupSet === undefined || ungroupSet.type === 'all') {
      // fields specified an an all, convert it to an exclude set.
      const allFields = ungroupSet?.fields || [];
      // convert an All into the equivalent exclude
      excludeFields = this.fields(
        fi =>
          isBasicScalar(fi.f) &&
          fi.fieldUsage.type === 'result' &&
          allFields.indexOf(fi.f.getIdentifier()) === -1
      ).map(fi => fi.f.getIdentifier());
    } else {
      excludeFields = ungroupSet.fields;
    }
    let firstScope = true;
    while (p !== undefined) {
      // get a list of valid fieldnames for the current scope.
      if (firstScope || ungroupSet?.type === 'exclude') {
        inScopeFieldNames = inScopeFieldNames.concat(
          p
            .fields(
              fi => isScalarField(fi.f) && fi.fieldUsage.type === 'result'
            )
            .map(fi => fi.f.getIdentifier())
        );
      }
      ret = ret.concat(
        p.fields(
          fi =>
            isScalarField(fi.f) &&
            fi.fieldUsage.type === 'result' &&
            excludeFields.indexOf(fi.f.getIdentifier()) === -1
        )
      );
      p = p.parent;
      firstScope = false;
    }
    // verify that all names specified are available in the current scope.
    for (const fieldName of ungroupSet?.fields || []) {
      if (inScopeFieldNames.indexOf(fieldName) === -1) {
        throw new Error(
          `${ungroupSet?.type}(): unknown field name "${fieldName}" or name not in scope.`
        );
      }
    }

    return ret;
  }

  assignFieldsToGroups() {
    for (const [_key, grouping] of this.ungroupedSets) {
      for (const fieldInstance of this.getUngroupPartitions(grouping)) {
        fieldInstance.additionalGroupSets.push(grouping.groupSet);
      }
    }
    for (const child of this.structs()) {
      child.assignFieldsToGroups();
    }
  }
}

/* Root Result as opposed to a turtled result */
class FieldInstanceResultRoot extends FieldInstanceResult {
  joins = new Map<string, JoinInstance>();
  havings = new AndChain();
  isComplexQuery = false;
  queryUsesPartitioning = false;
  computeOnlyGroups: number[] = [];
  elimatedComputeGroups = false;

  constructor(turtleDef: TurtleDef) {
    super(turtleDef, undefined);
  }

  root(): FieldInstanceResultRoot {
    return this;
  }

  // in the stage immediately following stage0 we need to elimiate any of the
  //  groups that were used in ungroup calculations.  We need to do this only
  //  once and in the very next stage.
  eliminateComputeGroupsSQL(): string {
    if (this.elimatedComputeGroups || this.computeOnlyGroups.length === 0) {
      return '';
    } else {
      this.elimatedComputeGroups = true;
      return `group_set NOT IN (${this.computeOnlyGroups.join(',')})`;
    }
  }

  // look at all the fields again in the structs in the query

  calculateSymmetricAggregates() {
    let leafiest: string | undefined;
    for (const [name, join] of this.joins) {
      // first join is by default the
      const relationship = join.parentRelationship();
      if (
        relationship === 'many_to_many' ||
        join.forceAllSymmetricCalculations()
      ) {
        // everything must be calculated with symmetric aggregates
        leafiest = '0never';
      } else if (leafiest === undefined) {
        leafiest = name;
      } else if (join.parentRelationship() === 'one_to_many') {
        // check up the parent relationship until you find
        //  the current leafiest node.  If it isn't in the direct path
        //  we need symmetric aggregate for everything.
        //  if it is in the path, than this one becomes leafiest
        const s = join.queryStruct;
        if (s.parent && s.parent.getIdentifier() === leafiest) {
          leafiest = name;
        } else {
          // we have more than on one_to_many join chain, all bets are off.
          leafiest = '0never';
        }
      }
    }
    // console.log(`LEAFIEST: ${leafiest}`);
    for (const [name, join] of this.joins) {
      join.leafiest = name === leafiest;
    }

    // figure out which joins we need to manufacture distinct keys for.
    //  Nested Unique keys are dependant on the primary key of the parent
    //  and the table.
    for (const [_name, join] of this.joins) {
      // in a one_to_many join we need a key to count there may be a failed
      //  match in a left join.
      // users -> {
      //   group_by: user_id
      //   aggregate: order_count is orders.count()
      if (
        // we have a leafiest count() joined subtree
        (join.leafiest &&
          join.parent !== undefined &&
          join.uniqueKeyPossibleUses.has('count')) ||
        // or not leafiest and we use an asymetric function
        (!join.leafiest && join.uniqueKeyPossibleUses.hasAsymetricFunctions())
      ) {
        let j: JoinInstance | undefined = join;
        while (j) {
          if (!j.queryStruct.primaryKey()) {
            j.makeUniqueKey = true;
          }
          if (j.queryStruct.structDef.type === 'array') {
            j = j.parent;
          } else {
            j = undefined;
          }
        }
      }
    }
  }
}

class JoinInstance {
  uniqueKeyPossibleUses: UniqueKeyUse = new UniqueKeyUse();
  makeUniqueKey = false;
  leafiest = false;
  joinFilterConditions?: QueryFieldBoolean[];
  children: JoinInstance[] = [];
  constructor(
    public queryStruct: QueryStruct,
    public alias: string,
    public parent: JoinInstance | undefined
  ) {
    if (parent) {
      parent.children.push(this);
    }

    // convert the filter list into a list of boolean fields so we can
    //  generate dependancies and code for them.
    const sd = this.queryStruct.structDef;
    if (isSourceDef(sd) && sd.filterList) {
      this.joinFilterConditions = sd.filterList.map(
        filter =>
          new QueryFieldBoolean(
            {
              type: 'boolean',
              name: 'ignoreme',
              e: filter.e,
            },
            this.queryStruct
          )
      );
    }
  }

  parentRelationship(): 'root' | JoinRelationship {
    if (this.queryStruct.parent === undefined) {
      return 'root';
    }
    const thisStruct = this.queryStruct.structDef;
    if (isJoined(thisStruct)) {
      switch (thisStruct.join) {
        case 'one':
          return 'many_to_one';
        case 'cross':
          return 'many_to_many';
        case 'many':
          return 'one_to_many';
      }
    }
    throw new Error(
      `Internal error unknown relationship type to parent for ${this.queryStruct.structDef.name}`
    );
  }

  // For now, we force all symmetric calculations for full and right joins
  //  because we need distinct keys for COUNT(xx) operations.  Don't really need
  //  this for sums.  This will produce correct results and we can optimize this
  //  at some point..
  forceAllSymmetricCalculations(): boolean {
    if (this.queryStruct.parent === undefined) {
      return false;
    }
    const thisStruct = this.queryStruct.structDef;
    if (isJoined(thisStruct)) {
      return (
        thisStruct.matrixOperation === 'right' ||
        thisStruct.matrixOperation === 'full'
      );
    }
    return false;
  }

  // postgres unnest needs to know the names of the physical fields.
  getDialectFieldList(): DialectFieldList {
    return getDialectFieldList(this.queryStruct.structDef);
  }
}

/**
 * Used by the translator to get the output StructDef of a pipe segment
 *
 * half translated to the new world of types ..
 */
export class Segment {
  static nextStructDef(
    structDef: SourceDef,
    segment: PipeSegment
  ): QueryResultDef {
    const qs = new QueryStruct(
      structDef,
      undefined,
      {
        model: new QueryModel(undefined),
      },
      {}
    );
    const turtleDef: TurtleDef = {
      type: 'turtle',
      name: 'ignoreme',
      pipeline: [segment],
    };

    const queryQueryQuery = QueryQuery.makeQuery(
      turtleDef,
      qs,
      new StageWriter(true, undefined), // stage write indicates we want to get a result.
      false
    );
    return queryQueryQuery.getResultStructDef();
  }
}

export function getResultStructDefForView(
  source: SourceDef,
  view: TurtleDef
): SourceDef {
  const qs = new QueryStruct(
    source,
    undefined,
    {
      model: new QueryModel(undefined),
    },
    {}
  );
  const queryQueryQuery = QueryQuery.makeQuery(
    view,
    qs,
    new StageWriter(true, undefined), // stage write indicates we want to get a result.
    false
  );
  return queryQueryQuery.getResultStructDef();
}

export function getResultStructDefForQuery(
  model: ModelDef,
  query: Query
): SourceDef {
  const queryModel = new QueryModel(model);
  const compiled = queryModel.compileQuery(query);
  return compiled.structs[compiled.structs.length - 1];
}

type StageGroupMaping = {fromGroup: number; toGroup: number};

type StageOutputContext = {
  sql: string[]; // sql expressions
  lateralJoinSQLExpressions: string[];
  dimensionIndexes: number[]; // which indexes are dimensions
  fieldIndex: number;
  groupsAggregated: StageGroupMaping[]; // which groups were aggregated
  outputPipelinedSQL: OutputPipelinedSQL[]; // secondary stages for turtles.
};

/** Query builder object. */
class QueryQuery extends QueryField {
  fieldDef: TurtleDef;
  firstSegment: PipeSegment;
  prepared = false;
  maxDepth = 0;
  maxGroupSet = 0;
  rootResult: FieldInstanceResultRoot;
  resultStage: string | undefined;
  stageWriter: StageWriter | undefined;
  isJoinedSubquery: boolean; // this query is a joined subquery.

  constructor(
    fieldDef: TurtleDef,
    parent: QueryStruct,
    stageWriter: StageWriter | undefined,
    isJoinedSubquery: boolean
  ) {
    super(fieldDef, parent);
    this.fieldDef = fieldDef;
    this.rootResult = new FieldInstanceResultRoot(fieldDef);
    this.stageWriter = stageWriter;
    // do some magic here to get the first segment.
    this.firstSegment = fieldDef.pipeline[0] as QuerySegment;
    this.isJoinedSubquery = isJoinedSubquery;
  }

  static makeQuery(
    fieldDef: TurtleDef,
    parentStruct: QueryStruct,
    stageWriter: StageWriter | undefined = undefined,
    isJoinedSubquery: boolean
  ): QueryQuery {
    let parent = parentStruct;

    let turtleWithFilters =
      parentStruct.applyStructFiltersToTurtleDef(fieldDef);
    const firstStage = turtleWithFilters.pipeline[0];
    const sourceDef = parentStruct.structDef;

    // if we are generating code
    //  and have extended declaration, we need to make a new QueryStruct
    //  copy the definitions into a new structdef
    //  edit the declations from the pipeline
    if (
      stageWriter !== undefined &&
      isQuerySegment(firstStage) &&
      firstStage.extendSource !== undefined
    ) {
      parent = new QueryStruct(
        {
          ...sourceDef,
          fields: [...sourceDef.fields, ...firstStage.extendSource],
        },
        parentStruct.sourceArguments,
        parent.parent ? {struct: parent} : {model: parent.model},
        parent.prepareResultOptions
      );
      turtleWithFilters = {
        ...turtleWithFilters,
        pipeline: [
          {
            ...firstStage,
            extendSource: undefined,
          },
          ...turtleWithFilters.pipeline.slice(1),
        ],
      };
    }

    if (
      isSourceDef(sourceDef) &&
      sourceDef.queryTimezone &&
      isQuerySegment(firstStage) &&
      firstStage.queryTimezone === undefined
    ) {
      firstStage.queryTimezone = sourceDef.queryTimezone;
    }

    switch (firstStage.type) {
      case 'reduce':
        return new QueryQueryReduce(
          turtleWithFilters,
          parent,
          stageWriter,
          isJoinedSubquery
        );
      case 'project':
        return new QueryQueryProject(
          turtleWithFilters,
          parent,
          stageWriter,
          isJoinedSubquery
        );
      case 'index':
        return new QueryQueryIndex(
          turtleWithFilters,
          parent,
          stageWriter,
          isJoinedSubquery
        );
      case 'raw':
        return new QueryQueryRaw(
          turtleWithFilters,
          parent,
          stageWriter,
          isJoinedSubquery
        );
      case 'partial':
        throw new Error('Attempt to make query out of partial stage');
    }
  }

  inNestedPipeline(): boolean {
    return this.parent.structDef.type === 'nest_source';
  }

  // get a field ref and expand it.
  expandField(f: QueryFieldDef) {
    const field =
      f.type === 'fieldref'
        ? this.parent.getQueryFieldReference(f.path, f.annotation)
        : this.parent.makeQueryField(f);
    const as = field.getIdentifier();
    return {as, field};
  }

  addDependantPath(
    resultStruct: FieldInstanceResult,
    context: QueryStruct,
    path: string[],
    uniqueKeyPossibleUse: UniqueKeyPossibleUse | undefined,
    joinStack: string[]
  ) {
    if (path.length === 0) {
      return;
    }
    const node = context.getFieldByName(path);
    const joinableParent =
      node instanceof QueryFieldStruct
        ? node.queryStruct.getJoinableParent()
        : node.parent.getJoinableParent();
    resultStruct
      .root()
      .addStructToJoin(joinableParent, this, uniqueKeyPossibleUse, joinStack);
  }

  findRecordAliases(context: QueryStruct, path: string[]) {
    for (const seg of path) {
      const field = context.getFieldByName([seg]);
      if (field instanceof QueryFieldStruct) {
        const qs = field.queryStruct;
        if (
          qs.structDef.type === 'record' &&
          hasExpression(qs.structDef) &&
          qs.parent
        ) {
          qs.informOfAliasValue(
            this.exprToSQL(this.rootResult, qs.parent, qs.structDef.e)
          );
        }
        context = qs;
      }
    }
  }

  addDependantExpr(
    resultStruct: FieldInstanceResult,
    context: QueryStruct,
    e: Expr,
    joinStack: string[]
  ): void {
    for (const expr of exprWalk(e)) {
      if (expr.node === 'function_call') {
        if (
          expressionIsAnalytic(expr.overload.returnType.expressionType) &&
          this.parent.dialect.cantPartitionWindowFunctionsOnExpressions &&
          resultStruct.firstSegment.type === 'reduce'
        ) {
          // force the use of a lateral_join_bag
          resultStruct.root().isComplexQuery = true;
          resultStruct.root().queryUsesPartitioning = true;
        }
        const isSymmetric = expr.overload.isSymmetric ?? false;
        const isAggregate = expressionIsAggregate(
          expr.overload.returnType.expressionType
        );
        const isAsymmetricAggregate = isAggregate && !isSymmetric;
        const uniqueKeyPossibleUse = isAsymmetricAggregate
          ? 'generic_asymmetric_aggregate'
          : undefined;
        if (expr.structPath) {
          this.addDependantPath(
            resultStruct,
            context,
            expr.structPath,
            uniqueKeyPossibleUse,
            joinStack
          );
        } else if (isAsymmetricAggregate) {
          resultStruct.addStructToJoin(
            context,
            this,
            uniqueKeyPossibleUse,
            joinStack
          );
        }
        if (expressionIsAnalytic(expr.overload.returnType.expressionType)) {
          resultStruct.root().queryUsesPartitioning = true;
        }
      } else if (expr.node === 'all' || expr.node === 'exclude') {
        resultStruct.resultUsesUngrouped = true;
        resultStruct.root().isComplexQuery = true;
        resultStruct.root().queryUsesPartitioning = true;
        if (expr.fields && expr.fields.length > 0) {
          const key = expr.fields.sort().join('|') + expr.node;
          if (resultStruct.ungroupedSets.get(key) === undefined) {
            resultStruct.ungroupedSets.set(key, {
              type: expr.node,
              fields: expr.fields,
              groupSet: -1,
            });
          }
        }
      }
      if (expr.node === 'field') {
        this.findRecordAliases(context, expr.path);
        const field = context.getDimensionOrMeasureByName(expr.path);
        if (hasExpression(field.fieldDef)) {
          this.addDependantExpr(
            resultStruct,
            field.parent,
            field.fieldDef.e,
            joinStack
          );
        } else {
          resultStruct
            .root()
            .addStructToJoin(
              field.parent.getJoinableParent(),
              this,
              undefined,
              joinStack
            );
        }
      } else if (expr.node === 'aggregate') {
        if (isAsymmetricExpr(expr)) {
          if (expr.structPath) {
            this.findRecordAliases(context, expr.structPath);
            this.addDependantPath(
              resultStruct,
              context,
              expr.structPath,
              expr.function,
              joinStack
            );
          } else {
            // we are doing a sum in the root.  It may need symetric aggregates
            resultStruct.addStructToJoin(
              context,
              this,
              expr.function,
              joinStack
            );
          }
        }
      }
    }
  }

  addDependancies(resultStruct: FieldInstanceResult, field: QueryField): void {
    if (hasExpression(field.fieldDef)) {
      this.addDependantExpr(resultStruct, field.parent, field.fieldDef.e, []);
    }
  }

  getSegmentFields(resultStruct: FieldInstanceResult): SegmentFieldDef[] {
    const fs = resultStruct.firstSegment;
    return fs.type === 'index'
      ? fs.indexFields
      : isQuerySegment(fs)
      ? fs.queryFields
      : [];
  }

  expandFields(resultStruct: FieldInstanceResult) {
    let resultIndex = 1;
    for (const f of this.getSegmentFields(resultStruct)) {
      const {as, field} = this.expandField(f);

      if (field instanceof QueryQuery) {
        if (this.firstSegment.type === 'project') {
          throw new Error(
            `Nested views cannot be used in select - '${field.fieldDef.name}'`
          );
        }
        const fir = new FieldInstanceResult(
          field.fieldDef as TurtleDef,
          resultStruct
        );
        this.expandFields(fir);
        resultStruct.add(as, fir);
      } else if (field instanceof QueryAtomicField) {
        resultStruct.addField(as, field, {
          resultIndex,
          type: 'result',
        });
        this.addDependancies(resultStruct, field);

        if (isBasicAggregate(field)) {
          if (this.firstSegment.type === 'project') {
            throw new Error(
              `Aggregate Fields cannot be used in select - '${field.fieldDef.name}'`
            );
          }
        }
      } else if (field instanceof QueryFieldStruct) {
        if (field.isAtomic()) {
          this.addDependancies(resultStruct, field);
        }
        resultStruct.addField(as, field, {
          resultIndex,
          type: 'result',
        });
      }
      // else if (
      //   this.firstSegment.type === "project" &&
      //   field instanceof QueryStruct
      // ) {
      //   // TODO lloyd refactor or comment why we do nothing here
      // } else {
      //   throw new Error(`'${as}' cannot be used as in this way.`);
      // }
      resultIndex++;
    }
    this.expandFilters(resultStruct);
  }

  expandFilters(resultStruct: FieldInstanceResult) {
    if (resultStruct.firstSegment.filterList === undefined) {
      return;
    }
    // Go through the filters and make or find dependant fields
    //  add them to the field index. Place the individual filters
    // in the correct catgory.
    for (const cond of resultStruct.firstSegment.filterList || []) {
      const context = this.parent;
      this.addDependantExpr(resultStruct, context, cond.e, []);
    }
    for (const join of resultStruct.root().joins.values() || []) {
      for (const qf of join.joinFilterConditions || []) {
        if (qf.fieldDef.type === 'boolean' && qf.fieldDef.e) {
          this.addDependantExpr(resultStruct, qf.parent, qf.fieldDef.e, []);
        }
      }
    }
  }

  generateSQLFilters(
    resultStruct: FieldInstanceResult,
    which: 'where' | 'having'
    // filterList: FilterCondition[] | undefined = undefined
  ): AndChain {
    const resultFilters = new AndChain();
    const list = resultStruct.firstSegment.filterList;
    if (list === undefined) {
      return resultFilters;
    }
    // Go through the filters and make or find dependant fields
    //  add them to the field index. Place the individual filters
    // in the correct catgory.
    for (const cond of list || []) {
      const context = this.parent;

      if (
        (which === 'having' && expressionIsCalculation(cond.expressionType)) ||
        (which === 'where' && expressionIsScalar(cond.expressionType))
      ) {
        const sqlClause = this.exprToSQL(
          resultStruct,
          context,
          cond.e,
          undefined
        );
        resultFilters.add(sqlClause);
      }
    }
    return resultFilters;
  }

  prepare(_stageWriter: StageWriter | undefined) {
    if (!this.prepared) {
      this.expandFields(this.rootResult);
      this.rootResult.addStructToJoin(this.parent, this, undefined, []);
      this.rootResult.findJoins(this);
      this.addAlwaysJoins(this.rootResult);
      this.rootResult.calculateSymmetricAggregates();
      this.prepared = true;
    }
  }

  addAlwaysJoins(rootResult: FieldInstanceResultRoot) {
    const stage = this.fieldDef.pipeline[0];
    if (stage.type !== 'raw') {
      const alwaysJoins = stage.alwaysJoins ?? [];
      for (const joinName of alwaysJoins) {
        const qs = this.parent.getChildByName(joinName);
        if (qs instanceof QueryFieldStruct) {
          rootResult.addStructToJoin(qs.queryStruct, this, undefined, []);
        }
      }
    }
  }

  // get the source fieldname and filters associated with the field (so we can drill later)
  getResultMetadata(
    fi: FieldInstance
  ): ResultStructMetadataDef | ResultMetadataDef | undefined {
    if (fi instanceof FieldInstanceField) {
      if (fi.fieldUsage.type === 'result') {
        // const fieldDef = fi.f.fieldDef as AtomicField;
        const fieldDef = fi.f.fieldDef;
        let filterList;
        const sourceField =
          fi.f.parent.getFullOutputName() +
          (fieldDef.name || fieldDef.as || 'undefined');
        const sourceExpression = hasExpression(fieldDef)
          ? fieldDef.code
          : undefined;
        const sourceClasses = [sourceField];
        const referenceId = fi.f.referenceId;
        const base = {
          sourceField,
          sourceExpression,
          sourceClasses,
          referenceId,
        };
        if (isBasicCalculation(fi.f)) {
          filterList = fi.f.getFilterList();
          return {
            ...base,
            filterList,
            fieldKind: 'measure',
          };
        }
        if (isBasicScalar(fi.f)) {
          return {
            ...base,
            filterList,
            fieldKind: 'dimension',
          };
        } else {
          return undefined;
        }
      }
      return undefined;
    } else if (fi instanceof FieldInstanceResult) {
      const sourceField = fi.turtleDef.name || fi.turtleDef.as;
      const sourceClasses = sourceField ? [sourceField] : [];
      const filterList = fi.firstSegment.filterList;

      const lastSegment =
        fi.turtleDef.pipeline[fi.turtleDef.pipeline.length - 1];
      const limit = isRawSegment(lastSegment) ? undefined : lastSegment.limit;
      let orderBy: OrderBy[] | undefined = undefined;
      if (isQuerySegment(lastSegment)) {
        orderBy = lastSegment.orderBy;
      }

      if (sourceField) {
        return {
          sourceField,
          filterList,
          sourceClasses,
          fieldKind: 'struct',
          limit,
          orderBy,
        };
      }
    }
    return undefined;
  }

  /**  returns a fields and primary key of a struct for this query */
  getResultStructDef(
    resultStruct: FieldInstanceResult = this.rootResult,
    isRoot = true
  ): QueryResultDef {
    const fields: FieldDef[] = [];
    let primaryKey;
    this.prepare(undefined);

    let dimCount = 0;
    for (const [name, fi] of resultStruct.allFields) {
      const resultMetadata = this.getResultMetadata(fi);
      if (fi instanceof FieldInstanceResult) {
        const {structDef, repeatedResultType} = this.generateTurtlePipelineSQL(
          fi,
          new StageWriter(true, undefined),
          '<nosource>'
        );

        if (repeatedResultType === 'nested') {
          const multiLineNest: RepeatedRecordDef = {
            ...structDef,
            type: 'array',
            elementTypeDef: {type: 'record_element'},
            join: 'many',
            name,
            resultMetadata,
          };
          fields.push(multiLineNest);
        } else {
          const oneLineNest: RecordDef = {
            ...structDef,
            type: 'record',
            join: 'one',
            name,
            resultMetadata,
          };
          fields.push(oneLineNest);
        }
      } else if (fi instanceof FieldInstanceField) {
        if (fi.fieldUsage.type === 'result') {
          // if there is only one dimension, it is the primaryKey
          //  if there are more, primaryKey is undefined.
          if (isBasicScalar(fi.f)) {
            if (dimCount === 0 && isRoot) {
              primaryKey = name;
            } else {
              primaryKey = undefined;
            }
            dimCount++;
          }

          // Remove computations because they are all resolved
          let fOut = fi.f.fieldDef;
          if (hasExpression(fOut)) {
            fOut = {...fOut};
            // "as" because delete needs the property to be optional
            delete (fOut as Expression).e;
            delete (fOut as Expression).code;
            delete (fOut as Expression).expressionType;
          }

          const location = fOut.location;
          const annotation = fOut.annotation;

          // build out the result fields...
          switch (fOut.type) {
            case 'boolean':
            case 'json':
            case 'string':
              fields.push({
                name,
                type: fOut.type,
                resultMetadata,
                location,
                annotation,
              });
              break;
            case 'date':
            case 'timestamp': {
              const timeframe = fOut.timeframe;
              const fd: TemporalTypeDef = {type: fOut.type};
              if (timeframe) {
                fd.timeframe = timeframe;
              }
              fields.push({
                name,
                ...fd,
                resultMetadata,
                location,
                annotation,
              });
              break;
            }
            case 'number':
              fields.push({
                name,
                numberType: fOut.numberType,
                type: 'number',
                resultMetadata,
                location,
                annotation,
              });
              break;
            case 'sql native':
            case 'record':
            case 'array': {
              fields.push({...fOut, resultMetadata});
              break;
            }
            default:
              throw new Error(
                `unknown Field Type in query ${JSON.stringify(fOut)}`
              );
          }
        }
      }
    }
    const outputStruct: StructDef = {
      type: 'query_result',
      name: this.resultStage || 'result',
      fields,
      dialect: this.parent.dialect.name,
      primaryKey,
      connection: this.parent.connectionName,
      resultMetadata: this.getResultMetadata(this.rootResult),
      queryTimezone: resultStruct.getQueryInfo().queryTimezone,
    };
    if (this.parent.structDef.modelAnnotation) {
      outputStruct.modelAnnotation = this.parent.structDef.modelAnnotation;
    }

    return outputStruct;
  }

  generateSQLJoinBlock(
    stageWriter: StageWriter,
    ji: JoinInstance,
    depth: number
  ): string {
    let s = '';
    const qs = ji.queryStruct;
    const qsDef = qs.structDef;
    qs.eventStream?.emit('join-used', {name: getIdentifier(qsDef)});
    qs.maybeEmitParameterizedSourceUsage();
    if (isJoinedSource(qsDef)) {
      let structSQL = qs.structSourceSQL(stageWriter);
      const matrixOperation = (qsDef.matrixOperation || 'left').toUpperCase();
      if (!this.parent.dialect.supportsFullJoin && matrixOperation === 'FULL') {
        throw new Error('FULL JOIN not supported');
      }
      if (ji.makeUniqueKey) {
        const passKeys = this.generateSQLPassthroughKeys(qs);
        structSQL = `(SELECT ${qs.dialect.sqlGenerateUUID()} as ${qs.dialect.sqlMaybeQuoteIdentifier(
          '__distinct_key'
        )}, x.* ${passKeys} FROM ${structSQL} as x)`;
      }
      let onCondition = '';
      if (qs.parent === undefined) {
        throw new Error('Expected joined struct to have a parent.');
      }
      if (qsDef.onExpression) {
        onCondition = new QueryFieldBoolean(
          {
            type: 'boolean',
            name: 'ignoreme',
            e: qsDef.onExpression,
          },
          qs.parent
        ).generateExpression(this.rootResult);
      } else {
        onCondition = '1=1';
      }
      let filters = '';
      let conditions: string[] | undefined = undefined;
      if (ji.joinFilterConditions) {
        conditions = ji.joinFilterConditions.map(qf =>
          qf.generateExpression(this.rootResult)
        );
      }

      if (
        ji.children.length === 0 ||
        conditions === undefined ||
        !this.parent.dialect.supportsComplexFilteredSources
      ) {
        // LTNOTE: need a check here to see the children's where: conditions are local
        //  to the source and not to any of it's joined children.
        //  In Presto, we're going to get a SQL error if in this case
        //  for now.  We need to inspect the 'condition' of each of the children
        //  to see if they reference subchildren and blow up if they do
        //  or move them to the where clause with a (x.distnct_key is NULL or (condition))
        //
        // const childrenFiltersAreComplex = somethign(conditions)
        // if (conditions && childrenFiltersAreComplex !this.parent.dialect.supportsComplexFilteredSources) {
        //   throw new Error(
        //     'Cannot join a source with a complex filter on a joined source'
        //   );
        // }

        if (conditions !== undefined && conditions.length >= 1) {
          filters = ` AND (${conditions.join(' AND ')})`;
        }
        s += ` ${matrixOperation} JOIN ${structSQL} AS ${ji.alias}\n  ON ${onCondition}${filters}\n`;
      } else {
        let select = `SELECT ${ji.alias}.*`;
        let joins = '';
        for (const childJoin of ji.children) {
          joins += this.generateSQLJoinBlock(stageWriter, childJoin, depth + 1);
          select += `, ${this.parent.dialect.sqlSelectAliasAsStruct(
            childJoin.alias,
            getDialectFieldList(childJoin.queryStruct.structDef)
          )} AS ${childJoin.alias}`;
        }
        select += `\nFROM ${structSQL} AS ${
          ji.alias
        }\n${joins}\nWHERE ${conditions?.join(' AND ')}\n`;
        s += `${matrixOperation} JOIN (\n${indent(select)}) AS ${
          ji.alias
        }\n  ON ${onCondition}\n`;
        return s;
      }
    } else if (qsDef.type === 'array') {
      if (qs.parent === undefined || ji.parent === undefined) {
        throw new Error('Internal Error, nested structure with no parent.');
      }
      // We need an SQL expression which results in the array for us to pass to un-nest
      let arrayExpression: string;

      if (hasExpression(qsDef)) {
        // If this array is NOT contained in the parent, but a computed entity
        // then the thing we are joining is not "parent.childName", but
        // the expression which is built in that namespace
        arrayExpression = this.exprToSQL(this.rootResult, qs.parent, qsDef.e);
      } else {
        // If this is a reference through an expression at the top level,
        // need to generate the expression because the expression is written
        // in the top level, this call is being used to generate the join.
        // Below the top level, the expression will have been written into
        // a join at the top level, and the name will exist.
        // ... not sure this is the right way to do this
        // ... the test for this is called "source repeated record containing an array"
        arrayExpression = qs.parent.sqlChildReference(
          qsDef.name,
          depth === 0 ? {result: this.rootResult, field: this} : undefined
        );
      }
      // we need to generate primary key.  If parent has a primary key combine
      // console.log(ji.alias, fieldExpression, this.inNestedPipeline());
      s += `${this.parent.dialect.sqlUnnestAlias(
        arrayExpression,
        ji.alias,
        ji.getDialectFieldList(),
        ji.makeUniqueKey,
        isBasicArray(qsDef),
        this.inNestedPipeline()
      )}\n`;
    } else if (qsDef.type === 'record') {
      throw new Error(
        'Internal Error: records should never appear in join trees'
      );
    } else {
      throw new Error(`Join type not implemented ${qs.structDef.type}`);
    }
    for (const childJoin of ji.children) {
      s += this.generateSQLJoinBlock(stageWriter, childJoin, depth + 1);
    }
    return s;
  }

  // BigQuery has wildcard psudo columns that are treated differently
  //  SELECT * FROM xxx doesn't include these psuedo columns but we need them so
  //  filters can get pushed down properly when generating a UNIQUE key.
  //  No other dialect really needs this so we are coding here but maybe someday
  //  this makes its way into the dialect.
  generateSQLPassthroughKeys(qs: QueryStruct): string {
    let ret = '';
    if (qs.dialect.name === 'standardsql') {
      const psudoCols = [
        '_TABLE_SUFFIX',
        '_PARTITIONDATE',
        '_PARTITIONTIME',
      ].filter(element => qs.getChildByName(element) !== undefined);
      if (psudoCols.length > 0) {
        ret = ', ' + psudoCols.join(', ');
      }
    }
    return ret;
  }

  generateSQLJoins(stageWriter: StageWriter): string {
    let s = '';
    // get the first value from the map (weird, I know)
    const [[, ji]] = this.rootResult.joins;
    const qs = ji.queryStruct;
    // Joins
    let structSQL = qs.structSourceSQL(stageWriter);
    if (isIndexSegment(this.firstSegment)) {
      structSQL = this.parent.dialect.sqlSampleTable(
        structSQL,
        this.firstSegment.sample
      );
      if (this.firstSegment.sample) {
        const limit = 100000;
        const limitClause = this.parent.dialect.limitClause;
        if (limitClause === 'limit') {
          structSQL = stageWriter.addStage(
            `SELECT * from ${structSQL} as x limit ${limit}`
          );
        } else if (limitClause === 'top') {
          structSQL = stageWriter.addStage(
            `SELECT TOP ${limit} * from ${structSQL} as x`
          );
        } else {
          throw new Error(`limitClause ${limitClause} not implemented`);
        }
      }
    }

    if (isBaseTable(qs.structDef)) {
      if (ji.makeUniqueKey) {
        const passKeys = this.generateSQLPassthroughKeys(qs);
        structSQL = `(SELECT ${qs.dialect.sqlGenerateUUID()} as ${qs.dialect.sqlMaybeQuoteIdentifier(
          '__distinct_key'
        )}, x.* ${passKeys} FROM ${structSQL} as x)`;
      }
      s += `FROM ${structSQL} as ${ji.alias}\n`;
    } else {
      throw new Error('Internal Error, queries must start from a basetable');
    }

    for (const childJoin of ji.children) {
      s += this.generateSQLJoinBlock(stageWriter, childJoin, 0);
    }
    return s;
  }

  generateSQLOrderBy(
    queryDef: QuerySegment,
    resultStruct: FieldInstanceResult
  ): string {
    let s = '';
    if (this.firstSegment.type === 'project' && !queryDef.orderBy) {
      return ''; // No default ordering for project.
    }
    // Intermediate results (in a pipeline or join) that have no limit, don't need an orderby
    //  Some database don't have this optimization.
    if (this.fieldDef.pipeline.length > 1 && queryDef.limit === undefined) {
      return '';
    }
    // ignore orderby if all aggregates.
    if (resultStruct.getRepeatedResultType() === 'inline_all_numbers') {
      return '';
    }

    // if we are in the last stage of a query and the query is a subquery
    //  and has no limit, ORDER BY is superfluous
    if (
      this.isJoinedSubquery &&
      this.fieldDef.pipeline.length === 1 &&
      queryDef.limit === undefined
    ) {
      return '';
    }

    const orderBy = queryDef.orderBy || resultStruct.calculateDefaultOrderBy();
    const o: string[] = [];
    for (const f of orderBy) {
      if (typeof f.field === 'string') {
        // convert name to an index
        const fi = resultStruct.getField(f.field);
        if (fi && fi.fieldUsage.type === 'result') {
          if (this.parent.dialect.orderByClause === 'ordinal') {
            o.push(`${fi.fieldUsage.resultIndex} ${f.dir || 'ASC'}`);
          } else if (this.parent.dialect.orderByClause === 'output_name') {
            o.push(
              `${this.parent.dialect.sqlMaybeQuoteIdentifier(f.field)} ${
                f.dir || 'ASC'
              }`
            );
          } else if (this.parent.dialect.orderByClause === 'expression') {
            const fieldExpr = fi.getSQL();
            o.push(`${fieldExpr} ${f.dir || 'ASC'}`);
          }
        } else {
          throw new Error(`Unknown field in ORDER BY ${f.field}`);
        }
      } else {
        if (this.parent.dialect.orderByClause === 'ordinal') {
          o.push(`${f.field} ${f.dir || 'ASC'}`);
        } else if (this.parent.dialect.orderByClause === 'output_name') {
          const orderingField = resultStruct.getFieldByNumber(f.field);
          o.push(
            `${this.parent.dialect.sqlMaybeQuoteIdentifier(
              orderingField.name
            )} ${f.dir || 'ASC'}`
          );
        } else if (this.parent.dialect.orderByClause === 'expression') {
          const orderingField = resultStruct.getFieldByNumber(f.field);
          const fieldExpr = orderingField.fif.getSQL();
          o.push(`${fieldExpr} ${f.dir || 'ASC'}`);
        }
      }
    }
    if (o.length > 0) {
      s = this.parent.dialect.sqlOrderBy(o, 'query') + '\n';
    }
    return s;
  }

  generateSimpleSQL(stageWriter: StageWriter): string {
    let s = 'SELECT';

    const limit =
      (!isRawSegment(this.firstSegment) && this.firstSegment.limit) || null;

    // top
    if (limit && this.parent.dialect.limitClause === 'top') {
      s += ` TOP ${limit}`;
    }
    s += '\n';

    const fields: string[] = [];

    for (const [name, field] of this.rootResult.allFields) {
      const fi = field as FieldInstanceField;
      const sqlName = this.parent.dialect.sqlMaybeQuoteIdentifier(name);
      if (fi.fieldUsage.type === 'result') {
        fields.push(
          ` ${fi.f.generateExpression(this.rootResult)} as ${sqlName}`
        );
      }
    }
    s += indent(fields.join(',\n')) + '\n';

    s += this.generateSQLJoins(stageWriter);
    s += this.generateSQLFilters(this.rootResult, 'where').sql('where');

    // group by
    if (this.firstSegment.type === 'reduce') {
      const n: string[] = [];
      for (const field of this.rootResult.fields()) {
        const fi = field as FieldInstanceField;
        if (fi.fieldUsage.type === 'result' && isScalarField(fi.f)) {
          const groupByClause = this.parent.dialect.groupByClause;
          if (groupByClause === 'ordinal') {
            n.push(fi.fieldUsage.resultIndex.toString());
          } else if (groupByClause === 'expression') {
            const fieldExpr = fi.f.generateExpression(this.rootResult);
            // TODO (vitor): Fix this. Avoiding numbers is not enough to avoid constant expressions
            if (fieldExpr && !NUMBER_EXPR.test(fieldExpr)) {
              n.push(fieldExpr);
            }
          } else {
            throw new Error(`groupByClause ${groupByClause} not implemented`);
          }
        }
      }
      if (n.length > 0) {
        s += `GROUP BY ${n.join(',')}\n`;
      }
    }

    s += this.generateSQLFilters(this.rootResult, 'having').sql('having');

    // order by
    s += this.generateSQLOrderBy(
      this.firstSegment as QuerySegment,
      this.rootResult
    );

    // limit
    if (limit && this.parent.dialect.limitClause === 'limit') {
      s += `LIMIT ${limit}\n`;
    }

    this.resultStage = stageWriter.addStage(s);
    return this.resultStage;
  }

  // This probably should be generated in a dialect independat way.
  //  but for now, it is just googleSQL.
  generatePipelinedStages(
    outputPipelinedSQL: OutputPipelinedSQL[],
    lastStageName: string,
    stageWriter: StageWriter
  ): string {
    if (outputPipelinedSQL.length === 0) {
      return lastStageName;
    }

    let retSQL: string;
    if (this.parent.dialect.supportsSelectReplace) {
      const pipelinesSQL = outputPipelinedSQL
        .map(o => `${o.pipelineSQL} as ${o.sqlFieldName}`)
        .join(',\n');
      retSQL = `SELECT * replace (${pipelinesSQL}) FROM ${lastStageName}
        `;
    } else {
      const pipelinesSQL = outputPipelinedSQL
        .map(o => `${o.pipelineSQL} as ${o.sqlFieldName}`)
        .join(',\n');
      const outputFields = outputPipelinedSQL.map(f => f.sqlFieldName);
      const allFields = Array.from(this.rootResult.allFields.keys()).map(f =>
        this.parent.dialect.sqlMaybeQuoteIdentifier(f)
      );
      const fields = allFields.filter(f => outputFields.indexOf(f) === -1);
      retSQL = `SELECT ${
        fields.length > 0 ? fields.join(', ') + ',' : ''
      } ${pipelinesSQL} FROM ${lastStageName}`;
    }
    return stageWriter.addStage(retSQL);
  }

  generateStage0Fields(
    resultSet: FieldInstanceResult,
    output: StageOutputContext,
    stageWriter: StageWriter
  ) {
    const scalarFields: [string, FieldInstanceField][] = [];
    const otherFields: [string, FieldInstance][] = [];
    for (const [name, fi] of resultSet.allFields) {
      if (fi instanceof FieldInstanceField && isScalarField(fi.f)) {
        scalarFields.push([name, fi]);
      } else {
        otherFields.push([name, fi]);
      }
    }
    const orderedFields = [...scalarFields, ...otherFields];

    for (const [name, fi] of orderedFields) {
      const outputName = this.parent.dialect.sqlMaybeQuoteIdentifier(
        `${name}__${resultSet.groupSet}`
      );
      if (fi instanceof FieldInstanceField) {
        if (fi.fieldUsage.type === 'result') {
          const exp = fi.getSQL();
          if (isScalarField(fi.f)) {
            if (
              this.parent.dialect.cantPartitionWindowFunctionsOnExpressions &&
              this.rootResult.queryUsesPartitioning &&
              resultSet.firstSegment.type === 'reduce'
            ) {
              // BigQuery can't partition aggregate function except when the field has no
              //  expression.  Additionally it can't partition by floats.  We stuff expressions
              //  and numbers as strings into a lateral join when the query has ungrouped expressions
              const outputFieldName = `__lateral_join_bag.${outputName}`;
              fi.analyticalSQL = outputFieldName;
              output.lateralJoinSQLExpressions.push(`${exp} as ${outputName}`);
              output.sql.push(outputFieldName);
              if (fi.f.fieldDef.type === 'number') {
                const outputNameString =
                  this.parent.dialect.sqlMaybeQuoteIdentifier(
                    `${name}__${resultSet.groupSet}_string`
                  );
                const outputFieldNameString = `__lateral_join_bag.${outputNameString}`;
                output.sql.push(outputFieldNameString);
                output.dimensionIndexes.push(output.fieldIndex++);
                output.lateralJoinSQLExpressions.push(
                  `CAST(${exp} as STRING) as ${outputNameString}`
                );
                fi.partitionSQL = outputFieldNameString;
              }
            } else {
              // just treat it like a regular field.
              output.sql.push(`${exp} as ${outputName}`);
            }
            output.dimensionIndexes.push(output.fieldIndex++);
          } else if (isBasicCalculation(fi.f)) {
            output.sql.push(`${exp} as ${outputName}`);
            output.fieldIndex++;
          }
        }
      } else if (fi instanceof FieldInstanceResult) {
        if (fi.firstSegment.type === 'reduce') {
          this.generateStage0Fields(fi, output, stageWriter);
        } else if (fi.firstSegment.type === 'project') {
          const s = this.generateTurtleSQL(
            fi,
            stageWriter,
            outputName,
            output.outputPipelinedSQL
          );
          output.sql.push(`${s} as ${outputName}`);
          output.fieldIndex++;
        }
      }
    }
    // LTNOTE: we could optimize here in the future.
    //  leaf turtles can have their having clauses in the main query
    //  turtles with leaves need to promote their state to their
    //  children.
    const having = this.generateSQLFilters(resultSet, 'having');
    if (!having.empty()) {
      // if we have no children, the having can run at the root level
      if (resultSet.childGroups.length === 1) {
        resultSet
          .root()
          .havings.add(
            `(group_set<>${resultSet.groupSet} OR (group_set=${
              resultSet.groupSet
            } AND ${having.sql()}))`
          );
      } else {
        resultSet.hasHaving = true;
        output.sql.push(
          `CASE WHEN group_set=${
            resultSet.groupSet
          } THEN CASE WHEN ${having.sql()} THEN 0 ELSE 1 END END as __delete__${
            resultSet.groupSet
          }`
        );
        output.fieldIndex++;
      }
    }
  }

  generateSQLWhereChildren(resultStruct: FieldInstanceResult): AndChain {
    const wheres = new AndChain();
    for (const [, field] of resultStruct.allFields) {
      if (field.type === 'query') {
        const fir = field as FieldInstanceResult;
        const turtleWhere = this.generateSQLFilters(fir, 'where');
        if (turtleWhere.present()) {
          const groupSets = fir.childGroups.join(',');
          wheres.add(
            `(group_set NOT IN (${groupSets})` +
              ` OR (group_set IN (${groupSets}) AND ${turtleWhere.sql()}))`
          );
        }
        wheres.addChain(this.generateSQLWhereChildren(fir));
      }
    }
    return wheres;
  }

  generateSQLWhereTurtled(): string {
    const wheres = this.generateSQLFilters(this.rootResult, 'where');
    wheres.addChain(this.generateSQLWhereChildren(this.rootResult));
    return wheres.sql('where');
  }

  // iterate over the nested queries looking for Havings (and someday limits).
  //  if you find any, generate a new stage(s) to perform these functions.
  generateSQLHavingLimit(
    stageWriter: StageWriter,
    lastStageName: string
  ): string {
    const fields: string[] = [];
    const resultsWithHaving = this.rootResult.selectStructs(
      [],
      (result: FieldInstanceResult) => result.hasHaving
    );

    if (resultsWithHaving.length > 0) {
      for (const result of resultsWithHaving) {
        // find all the parent dimension names.
        const dimensions: string[] = [];
        let r: FieldInstanceResult | undefined = result;
        while (r) {
          for (const name of r.fieldNames(fi => isScalarField(fi.f))) {
            dimensions.push(
              this.parent.dialect.sqlMaybeQuoteIdentifier(
                `${name}__${r.groupSet}`
              )
            );
          }
          r = r.parent;
        }

        let partition = '';
        if (dimensions.length > 0) {
          partition = 'partition by ';
          partition += dimensions
            .map(this.parent.dialect.castToString)
            .join(',');
        }
        fields.push(
          `MAX(CASE WHEN group_set IN (${result.childGroups.join(
            ','
          )}) THEN __delete__${
            result.groupSet
          } END) OVER(${partition}) as __shaving__${result.groupSet}`
        );
      }
    }
    if (resultsWithHaving.length > 0) {
      lastStageName = stageWriter.addStage(
        `SELECT\n  *,\n  ${fields.join(',\n  ')} \nFROM ${lastStageName}`
      );
      const havings = new AndChain();
      for (const result of resultsWithHaving) {
        havings.add(
          `group_set IN (${result.childGroups.join(',')}) AND __shaving__${
            result.groupSet
          }=1`
        );
      }
      lastStageName = stageWriter.addStage(
        `SELECT *\nFROM ${lastStageName}\nWHERE NOT (${havings.sqlOr()})`
      );
    }
    return lastStageName;
  }

  generateSQLStage0(stageWriter: StageWriter): string {
    let s = 'SELECT\n';
    let from = this.generateSQLJoins(stageWriter);
    const wheres = this.generateSQLWhereTurtled();

    const f: StageOutputContext = {
      dimensionIndexes: [1],
      fieldIndex: 2,
      sql: ['group_set'],
      lateralJoinSQLExpressions: [],
      groupsAggregated: [],
      outputPipelinedSQL: [],
    };
    this.generateStage0Fields(this.rootResult, f, stageWriter);

    if (
      this.firstSegment.type === 'project' &&
      !this.parent.modelCompilerFlags().has('unsafe_complex_select_query')
    ) {
      throw new Error('PROJECT cannot be used on queries with turtles');
    }

    const n = (() => {
      const groupByClause = this.parent.dialect.groupByClause;
      if (groupByClause === 'ordinal') {
        return f.dimensionIndexes;
      } else if (groupByClause === 'expression') {
        return f.dimensionIndexes
          .map(this.rootResult.getFieldByNumber)
          .map(fbn => fbn.fif.getSQL())
          .filter((v): v is string => !!v && !NUMBER_EXPR.test(v)); // TODO (vitor): !NUMBER_EXPR is not enough
      } else {
        throw new Error(`groupByClause ${groupByClause} not implemented`);
      }
    })();

    const groupBy = `GROUP BY ${n.join(', ')}\n`;

    from += this.parent.dialect.sqlGroupSetTable(this.maxGroupSet) + '\n';

    s += indent(f.sql.join(',\n')) + '\n';

    // this should only happen on standard SQL,  BigQuery can't partition by expressions and
    //  aggregates.
    if (f.lateralJoinSQLExpressions.length > 0) {
      from += `LEFT JOIN UNNEST([STRUCT(${f.lateralJoinSQLExpressions.join(
        ',\n'
      )})]) as __lateral_join_bag\n`;
    }

    s += from + wheres + groupBy + this.rootResult.havings.sql('having');

    // generate the stage
    const resultStage = stageWriter.addStage(s);

    // generate stages for havings and limits
    this.resultStage = this.generateSQLHavingLimit(stageWriter, resultStage);

    this.resultStage = this.generatePipelinedStages(
      f.outputPipelinedSQL,
      this.resultStage,
      stageWriter
    );

    return this.resultStage;
  }

  generateDepthNFields(
    depth: number,
    resultSet: FieldInstanceResult,
    output: StageOutputContext,
    stageWriter: StageWriter
  ) {
    const groupsToMap: number[] = [];
    for (const [name, fi] of resultSet.allFields) {
      const sqlFieldName = this.parent.dialect.sqlMaybeQuoteIdentifier(
        `${name}__${resultSet.groupSet}`
      );
      if (fi instanceof FieldInstanceField) {
        if (fi.fieldUsage.type === 'result') {
          if (isScalarField(fi.f)) {
            const exp = this.caseGroup(
              resultSet.groupSet > 0 ? resultSet.childGroups : [],
              sqlFieldName
            );
            output.sql.push(`${exp} as ${sqlFieldName}`);
            output.dimensionIndexes.push(output.fieldIndex++);
          } else if (isBasicCalculation(fi.f)) {
            const exp = this.parent.dialect.sqlAnyValue(
              resultSet.groupSet,
              sqlFieldName
            );
            output.sql.push(`${exp} as ${sqlFieldName}`);
            output.fieldIndex++;
          }
        }
      } else if (fi instanceof FieldInstanceResult) {
        if (fi.depth > depth) {
          // ignore it, we've already dealt with it.
        } else if (fi.depth === depth) {
          const s = this.generateTurtleSQL(
            fi,
            stageWriter,
            sqlFieldName,
            output.outputPipelinedSQL
          );
          output.groupsAggregated.push({
            fromGroup: fi.groupSet,
            toGroup: resultSet.groupSet,
          });
          groupsToMap.push(fi.groupSet);
          output.sql.push(`${s} as ${sqlFieldName}`);
          output.fieldIndex++;
        } else {
          this.generateDepthNFields(depth, fi, output, stageWriter);
        }
      }
    }
    if (output.groupsAggregated.length > 0) {
      output.sql[0] = 'CASE ';
      for (const m of output.groupsAggregated) {
        output.sql[0] += `WHEN group_set=${m.fromGroup} THEN ${m.toGroup} `;
      }
      output.sql[0] += 'ELSE group_set END as group_set';
    }
  }

  generateSQLDepthN(
    depth: number,
    stageWriter: StageWriter,
    stageName: string
  ): string {
    let s = 'SELECT \n';
    const f: StageOutputContext = {
      dimensionIndexes: [1],
      fieldIndex: 2,
      sql: ['group_set'],
      lateralJoinSQLExpressions: [],
      groupsAggregated: [],
      outputPipelinedSQL: [],
    };
    this.generateDepthNFields(depth, this.rootResult, f, stageWriter);
    s += indent(f.sql.join(',\n')) + '\n';
    s += `FROM ${stageName}\n`;
    const where = this.rootResult.eliminateComputeGroupsSQL();
    if (where.length > 0) {
      s += `WHERE ${where}\n`;
    }

    // group by
    const n = (() => {
      const groupByClause = this.parent.dialect.groupByClause;
      if (groupByClause === 'ordinal') {
        return f.dimensionIndexes;
      } else if (groupByClause === 'expression') {
        return f.dimensionIndexes
          .map(this.rootResult.getFieldByNumber)
          .map(fbn => fbn.fif.getSQL())
          .filter((v): v is string => !!v && !NUMBER_EXPR.test(v));
      } else {
        throw new Error(`groupByClause ${groupByClause} not implemented`);
      }
    })();
    const groupBy = n.length ? `GROUP BY ${n.join(', ')}\n` : '';

    s += groupBy;

    this.resultStage = stageWriter.addStage(s);

    this.resultStage = this.generatePipelinedStages(
      f.outputPipelinedSQL,
      this.resultStage,
      stageWriter
    );

    return this.resultStage;
  }

  genereateSQLCombineTurtles(
    stageWriter: StageWriter,
    stage0Name: string
  ): string {
    const limit =
      (!isRawSegment(this.firstSegment) && this.firstSegment.limit) || null;

    let s = 'SELECT';

    // top
    if (limit && this.parent.dialect.limitClause === 'top') {
      s += ` TOP ${limit}`;
    }
    s += '\n';

    const fieldsSQL: string[] = [];
    let fieldIndex = 1;
    const outputPipelinedSQL: OutputPipelinedSQL[] = [];
    const dimensionIndexes: number[] = [];
    for (const [name, fi] of this.rootResult.allFields) {
      const sqlName = this.parent.dialect.sqlMaybeQuoteIdentifier(name);
      if (fi instanceof FieldInstanceField) {
        if (fi.fieldUsage.type === 'result') {
          if (isScalarField(fi.f)) {
            fieldsSQL.push(
              this.parent.dialect.sqlMaybeQuoteIdentifier(
                `${name}__${this.rootResult.groupSet}`
              ) + ` as ${sqlName}`
            );
            dimensionIndexes.push(fieldIndex++);
          } else if (isBasicCalculation(fi.f)) {
            fieldsSQL.push(
              this.parent.dialect.sqlAnyValueLastTurtle(
                this.parent.dialect.sqlMaybeQuoteIdentifier(
                  `${name}__${this.rootResult.groupSet}`
                ),
                this.rootResult.groupSet,
                sqlName
              )
            );
            fieldIndex++;
          }
        }
      } else if (fi instanceof FieldInstanceResult) {
        if (fi.firstSegment.type === 'reduce') {
          fieldsSQL.push(
            `${this.generateTurtleSQL(
              fi,
              stageWriter,
              sqlName,
              outputPipelinedSQL
            )} as ${sqlName}`
          );
          fieldIndex++;
        } else if (fi.firstSegment.type === 'project') {
          fieldsSQL.push(
            this.parent.dialect.sqlAnyValueLastTurtle(
              this.parent.dialect.sqlMaybeQuoteIdentifier(
                `${name}__${this.rootResult.groupSet}`
              ),
              this.rootResult.groupSet,
              sqlName
            )
          );
          fieldIndex++;
        }
      }
    }
    s += indent(fieldsSQL.join(',\n')) + `\nFROM ${stage0Name}\n`;

    const where = this.rootResult.eliminateComputeGroupsSQL();
    if (where.length > 0) {
      s += `WHERE ${where}\n`;
    }

    // group by
    const n = (() => {
      const groupByClause = this.parent.dialect.groupByClause;
      if (groupByClause === 'ordinal') {
        return dimensionIndexes;
      } else if (groupByClause === 'expression') {
        return dimensionIndexes
          .map(this.rootResult.getFieldByNumber)
          .map(fbn => fbn.fif.getSQL())
          .filter((v): v is string => !!v && !NUMBER_EXPR.test(v));
      } else {
        throw new Error(`groupByClause ${groupByClause} not implemented`);
      }
    })();
    const groupBy = n.length ? `GROUP BY ${n.join(', ')}\n` : '';

    s += groupBy;

    s += this.generateSQLOrderBy(
      this.firstSegment as QuerySegment,
      this.rootResult
    );

    // limit
    if (limit && this.parent.dialect.limitClause === 'limit') {
      s += `LIMIT ${limit}\n`;
    }

    this.resultStage = stageWriter.addStage(s);
    this.resultStage = this.generatePipelinedStages(
      outputPipelinedSQL,
      this.resultStage,
      stageWriter
    );

    return this.resultStage;
  }

  // create a simplified version of the StructDef for dialects.
  buildDialectFieldList(resultStruct: FieldInstanceResult): DialectFieldList {
    const dialectFieldList: DialectFieldList = [];

    for (const [name, field] of resultStruct.allFields) {
      const sqlName = this.parent.dialect.sqlMaybeQuoteIdentifier(name);
      //
      if (
        resultStruct.firstSegment.type === 'reduce' &&
        field instanceof FieldInstanceResult
      ) {
        const {structDef, repeatedResultType} = this.generateTurtlePipelineSQL(
          field,
          new StageWriter(true, undefined),
          '<nosource>'
        );
        if (repeatedResultType === 'nested') {
          const multiLineNest: RepeatedRecordDef = {
            ...structDef,
            type: 'array',
            elementTypeDef: {type: 'record_element'},
            join: 'many',
            name,
          };
          dialectFieldList.push({
            typeDef: multiLineNest,
            sqlExpression: this.parent.dialect.sqlMaybeQuoteIdentifier(
              `${name}__${resultStruct.groupSet}`
            ),
            rawName: name,
            sqlOutputName: sqlName,
          });
        } else {
          const oneLineNest: RecordDef = {
            ...structDef,
            type: 'record',
            join: 'one',
            name,
          };
          dialectFieldList.push({
            typeDef: oneLineNest,
            sqlExpression: this.parent.dialect.sqlMaybeQuoteIdentifier(
              `${name}__${resultStruct.groupSet}`
            ),
            rawName: name,
            sqlOutputName: sqlName,
          });
        }
      } else if (
        resultStruct.firstSegment.type === 'reduce' &&
        field instanceof FieldInstanceField &&
        field.fieldUsage.type === 'result'
      ) {
        pushDialectField(dialectFieldList, {
          fieldDef: field.f.fieldDef,
          sqlExpression: this.parent.dialect.sqlMaybeQuoteIdentifier(
            `${name}__${resultStruct.groupSet}`
          ),
          rawName: name,
          sqlOutputName: sqlName,
        });
      } else if (
        resultStruct.firstSegment.type === 'project' &&
        field instanceof FieldInstanceField &&
        field.fieldUsage.type === 'result'
      ) {
        pushDialectField(dialectFieldList, {
          fieldDef: field.f.fieldDef,
          sqlExpression: field.f.generateExpression(resultStruct),
          rawName: name,
          sqlOutputName: sqlName,
        });
      }
    }
    return dialectFieldList;
  }

  generateTurtleSQL(
    resultStruct: FieldInstanceResult,
    stageWriter: StageWriter,
    sqlFieldName: string,
    outputPipelinedSQL: OutputPipelinedSQL[]
  ): string {
    // let fieldsSQL: string[] = [];
    let orderBy = '';
    const limit = isRawSegment(resultStruct.firstSegment)
      ? undefined
      : resultStruct.firstSegment.limit;

    // calculate the ordering.
    const obSQL: string[] = [];
    let orderingField;
    const orderByDef =
      (resultStruct.firstSegment as QuerySegment).orderBy ||
      resultStruct.calculateDefaultOrderBy();
    for (const ordering of orderByDef) {
      if (typeof ordering.field === 'string') {
        orderingField = {
          name: ordering.field,
          fif: resultStruct.getField(ordering.field),
        };
      } else {
        orderingField = resultStruct.getFieldByNumber(ordering.field);
      }
      if (resultStruct.firstSegment.type === 'reduce') {
        obSQL.push(
          ' ' +
            this.parent.dialect.sqlMaybeQuoteIdentifier(
              `${orderingField.name}__${resultStruct.groupSet}`
            ) +
            ` ${ordering.dir || 'ASC'}`
        );
      } else if (resultStruct.firstSegment.type === 'project') {
        obSQL.push(
          ` ${orderingField.fif.f.generateExpression(resultStruct)} ${
            ordering.dir || 'ASC'
          }`
        );
      }
    }

    if (obSQL.length > 0) {
      orderBy = ' ' + this.parent.dialect.sqlOrderBy(obSQL, 'turtle');
    }

    const dialectFieldList = this.buildDialectFieldList(resultStruct);

    let resultType;
    let ret;
    if ((resultType = resultStruct.getRepeatedResultType()) !== 'nested') {
      if (resultType === 'inline_all_numbers') {
        ret = this.parent.dialect.sqlCoaleseMeasuresInline(
          resultStruct.groupSet,
          dialectFieldList
        );
      } else {
        ret = this.parent.dialect.sqlAnyValueTurtle(
          resultStruct.groupSet,
          dialectFieldList
        );
      }
    } else {
      ret = this.parent.dialect.sqlAggregateTurtle(
        resultStruct.groupSet,
        dialectFieldList,
        orderBy,
        limit
      );
    }

    // If the turtle is a pipeline, generate a UDF to compute it.
    const newStageWriter = new StageWriter(
      this.parent.dialect.supportsCTEinCoorelatedSubQueries,
      stageWriter
    );
    const {structDef, pipeOut} = this.generateTurtlePipelineSQL(
      resultStruct,
      newStageWriter,
      this.parent.dialect.supportUnnestArrayAgg ? ret : sqlFieldName
    );

    // if there was a pipeline.
    if (pipeOut !== undefined) {
      const sql = newStageWriter.generateCoorelatedSubQuery(
        this.parent.dialect,
        structDef
      );

      if (this.parent.dialect.supportUnnestArrayAgg) {
        ret = `(${sql})`;
      } else {
        outputPipelinedSQL.push({
          sqlFieldName,
          pipelineSQL: `(${sql})`,
        });
      }
    }

    return ret;
    // return `${aggregateFunction}(CASE WHEN group_set=${
    //   resultStruct.groupSet
    // } THEN STRUCT(${fieldsSQL.join(",\n")}) END${tailSQL})`;
  }

  generateTurtlePipelineSQL(
    fi: FieldInstanceResult,
    stageWriter: StageWriter,
    sourceSQLExpression: string
  ) {
    let structDef = this.getResultStructDef(fi, false);
    const repeatedResultType = fi.getRepeatedResultType();
    const hasPipeline = fi.turtleDef.pipeline.length > 1;
    let pipeOut;
    let outputRepeatedResultType = repeatedResultType;
    if (hasPipeline) {
      const pipeline: PipeSegment[] = [...fi.turtleDef.pipeline];
      pipeline.shift();
      const newTurtle: TurtleDef = {
        type: 'turtle',
        name: 'starthere',
        pipeline,
      };
      const inputStruct: NestSourceDef = {
        type: 'nest_source',
        name: '~pipe~',
        pipeSQL: this.parent.dialect.sqlUnnestPipelineHead(
          repeatedResultType === 'inline_all_numbers',
          sourceSQLExpression,
          getDialectFieldList(structDef)
        ),
        fields: structDef.fields,
        connection: structDef.connection,
        dialect: structDef.dialect,
      };
      const qs = new QueryStruct(
        inputStruct,
        undefined,
        {model: this.parent.getModel()},
        this.parent.prepareResultOptions
      );
      const q = QueryQuery.makeQuery(
        newTurtle,
        qs,
        stageWriter,
        this.isJoinedSubquery
      );
      pipeOut = q.generateSQLFromPipeline(stageWriter);
      outputRepeatedResultType = q.rootResult.getRepeatedResultType();
      // console.log(stageWriter.generateSQLStages());
      structDef = pipeOut.outputStruct;
    }
    structDef.annotation = fi.turtleDef.annotation;
    return {
      structDef,
      pipeOut,
      repeatedResultType: outputRepeatedResultType,
    };
  }

  generateComplexSQL(stageWriter: StageWriter): string {
    let stageName = this.generateSQLStage0(stageWriter);

    if (this.maxDepth > 1) {
      let i = this.maxDepth;
      while (i > 1) {
        stageName = this.generateSQLDepthN(i, stageWriter, stageName);
        i--;
      }
    }

    // nest the turtles.
    return this.genereateSQLCombineTurtles(stageWriter, stageName);
  }

  generateSQL(stageWriter: StageWriter): string {
    const r = this.rootResult.computeGroups(0, 0);
    this.maxDepth = r.maxDepth;
    this.maxGroupSet = r.nextGroupSetNumber - 1;

    this.rootResult.assignFieldsToGroups();

    this.rootResult.isComplexQuery ||= this.maxDepth > 0 || r.isComplex;
    if (this.rootResult.isComplexQuery) {
      return this.generateComplexSQL(stageWriter);
    } else {
      return this.generateSimpleSQL(stageWriter);
    }
  }

  generateSQLFromPipeline(stageWriter: StageWriter): {
    lastStageName: string;
    outputStruct: QueryResultDef;
  } {
    this.parent.maybeEmitParameterizedSourceUsage();
    this.prepare(stageWriter);
    let lastStageName = this.generateSQL(stageWriter);
    let outputStruct = this.getResultStructDef();
    const pipeline = [...this.fieldDef.pipeline];
    if (pipeline.length > 1) {
      // console.log(pretty(outputStruct));
      let structDef: FinalizeSourceDef = {
        ...outputStruct,
        name: lastStageName,
        type: 'finalize',
      };
      pipeline.shift();
      for (const transform of pipeline) {
        const parent = this.parent.parent
          ? {struct: this.parent.parent}
          : {model: this.parent.getModel()};
        const s = new QueryStruct(
          structDef,
          undefined,
          parent,
          this.parent.prepareResultOptions
        );
        const q = QueryQuery.makeQuery(
          {type: 'turtle', name: '~computeLastStage~', pipeline: [transform]},
          s,
          stageWriter,
          this.isJoinedSubquery
        );
        q.prepare(stageWriter);
        lastStageName = q.generateSQL(stageWriter);
        outputStruct = q.getResultStructDef();
        structDef = {
          ...outputStruct,
          name: lastStageName,
          type: 'finalize',
        };
      }
    }
    return {lastStageName, outputStruct};
  }
}
class QueryQueryReduce extends QueryQuery {}

class QueryQueryProject extends QueryQuery {}

// generates a single stage query for the index.
//  wildcards have been expanded
//  nested repeated fields are safe to use.
class QueryQueryIndexStage extends QueryQuery {
  fieldDef: TurtleDef;
  indexPaths: Record<string, string[]> = {};
  constructor(
    fieldDef: TurtleDef,
    parent: QueryStruct,
    stageWriter: StageWriter | undefined,
    isJoinedSubquery: boolean
  ) {
    super(fieldDef, parent, stageWriter, isJoinedSubquery);
    this.fieldDef = fieldDef;
  }

  expandField(f: IndexFieldDef) {
    const as = f.path.join('.');
    const field = this.parent.getQueryFieldByName(f.path);
    return {as, field};
  }

  expandFields(resultStruct: FieldInstanceResult) {
    let resultIndex = 1;
    const groupIndex = resultStruct.groupSet;
    this.maxGroupSet = groupIndex;

    for (const f of (this.firstSegment as IndexSegment).indexFields) {
      const {as, field} = this.expandField(f);
      this.indexPaths[as] = f.path;

      resultStruct.addField(as, field as QueryField, {
        resultIndex,
        type: 'result',
      });
      if (field instanceof QueryAtomicField) {
        this.addDependancies(resultStruct, field);
      }
      resultIndex++;
    }
    const measure = (this.firstSegment as IndexSegment).weightMeasure;
    if (measure !== undefined) {
      const f = this.parent.getFieldByName([measure]) as QueryField;
      resultStruct.addField(measure, f, {
        resultIndex,
        type: 'result',
      });
      this.addDependancies(resultStruct, f);
    }
    this.expandFilters(resultStruct);
  }

  generateSQL(stageWriter: StageWriter): string {
    let measureSQL = 'COUNT(*)';
    const dialect = this.parent.dialect;
    const fieldNameColumn = dialect.sqlMaybeQuoteIdentifier('fieldName');
    const fieldPathColumn = dialect.sqlMaybeQuoteIdentifier('fieldPath');
    const fieldValueColumn = dialect.sqlMaybeQuoteIdentifier('fieldValue');
    const fieldTypeColumn = dialect.sqlMaybeQuoteIdentifier('fieldType');
    const fieldRangeColumn = dialect.sqlMaybeQuoteIdentifier('fieldRange');
    const weightColumn = dialect.sqlMaybeQuoteIdentifier('weight');
    const measureName = (this.firstSegment as IndexSegment).weightMeasure;
    if (measureName) {
      measureSQL = this.rootResult
        .getField(measureName)
        .f.generateExpression(this.rootResult);
    }

    const fields: Array<{
      name: string;
      path: string[];
      type: string;
      expression: string;
    }> = [];
    for (const [name, field] of this.rootResult.allFields) {
      const fi = field as FieldInstanceField;
      if (fi.fieldUsage.type === 'result' && isScalarField(fi.f)) {
        const expression = fi.f.generateExpression(this.rootResult);
        const path = this.indexPaths[name] || [];
        fields.push({name, path, type: fi.f.fieldDef.type, expression});
      }
    }

    let s = 'SELECT';

    const limit =
      (!isRawSegment(this.firstSegment) && this.firstSegment.limit) || null;

    // top
    if (limit && this.parent.dialect.limitClause === 'top') {
      s += ` TOP ${limit}`;
    }
    s += '\n';
    s += ' group_set,\n';

    let fieldNameExpr = '  CASE group_set\n';
    for (let i = 0; i < fields.length; i++) {
      fieldNameExpr += `    WHEN ${i} THEN '${fields[i].name}'\n`;
    }
    fieldNameExpr += '  END ';
    s += `${fieldNameExpr} as ${fieldNameColumn},\n`;

    let fieldPathExpr = '  CASE group_set\n';
    for (let i = 0; i < fields.length; i++) {
      const path = pathToCol(fields[i].path);
      fieldPathExpr += `    WHEN ${i} THEN '${path}'\n`;
    }
    fieldPathExpr += '  END ';
    s += `${fieldPathExpr} as ${fieldPathColumn},\n`;

    let fieldTypeExpr = '  CASE group_set\n';
    for (let i = 0; i < fields.length; i++) {
      fieldTypeExpr += `    WHEN ${i} THEN '${fields[i].type}'\n`;
    }
    fieldTypeExpr += '  END ';
    s += `${fieldTypeExpr} as ${fieldTypeColumn},`;

    let fieldValueExpr = `  CASE group_set WHEN 99999 THEN ${dialect.castToString(
      'NULL'
    )}\n`;
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].type === 'string') {
        fieldValueExpr += `    WHEN ${i} THEN ${fields[i].expression}\n`;
      }
    }
    fieldValueExpr += '  END ';
    s += `${fieldValueExpr} as ${fieldValueColumn},\n`;

    s += ` ${measureSQL} as ${weightColumn},\n`;

    // just in case we don't have any field types, force the case statement to have at least one value.
    s += "  CASE group_set\n    WHEN 99999 THEN ''";
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].type === 'number') {
        s += `    WHEN ${i} THEN ${dialect.concat(
          `MIN(${dialect.castToString(fields[i].expression)})`,
          "' to '",
          dialect.castToString(`MAX(${fields[i].expression})`)
        )}\n`;
      }
      if (fields[i].type === 'timestamp' || fields[i].type === 'date') {
        s += `    WHEN ${i} THEN ${dialect.concat(
          `MIN(${dialect.sqlDateToString(fields[i].expression)})`,
          "' to '",
          `MAX(${dialect.sqlDateToString(fields[i].expression)})`
        )}\n`;
      }
    }
    s += `  END as ${fieldRangeColumn}\n`;

    // CASE
    //   WHEN field_type = 'timestamp' or field_type = 'date'
    //     THEN MIN(field_value) || ' to ' || MAX(field_value)
    //   WHEN field_type = 'number'
    //     THEN
    // ELSE NULL
    // END as field_range\n`;

    s += this.generateSQLJoins(stageWriter);

    s += dialect.sqlGroupSetTable(fields.length) + '\n';

    s += this.generateSQLFilters(this.rootResult, 'where').sql('where');

    // group by
    const n: string[] = [];
    if (this.parent.dialect.groupByClause === 'expression') {
      n.push(
        'group_set',
        fieldNameExpr,
        fieldPathExpr,
        fieldTypeExpr,
        fieldValueExpr
      );
    } else {
      n.push('1', '2', '3', '4', '5');
    }
    // For index search, we use the column names directly regardless of dialect
    s += `GROUP BY ${n.join(', ')}\n`;

    // limit
    if (limit && this.parent.dialect.limitClause === 'limit') {
      s += `LIMIT ${limit}\n`;
    }

    // console.log(s);
    const resultStage = stageWriter.addStage(s);
    this.resultStage = stageWriter.addStage(
      `SELECT
  ${fieldNameColumn},
  ${fieldPathColumn},
  ${fieldTypeColumn},
  COALESCE(${fieldValueColumn}, ${fieldRangeColumn}) as ${fieldValueColumn},
  ${weightColumn}
FROM ${resultStage}\n`
    );
    return this.resultStage;
  }
}

class QueryQueryRaw extends QueryQuery {
  generateSQL(stageWriter: StageWriter): string {
    if (this.parent.structDef.type !== 'sql_select') {
      throw new Error(
        'Invalid struct for QueryQueryRaw, currently only supports SQL'
      );
    }
    return stageWriter.addStage(this.parent.structDef.selectStr);
  }

  prepare() {
    // Do nothing!
  }

  getResultStructDef(): QueryResultDef {
    if (!isSourceDef(this.parent.structDef)) {
      throw new Error(`Result cannot be type ${this.parent.structDef.type}`);
    }
    return {...this.parent.structDef, type: 'query_result'};
  }

  getResultMetadata(
    _fi: FieldInstance
  ): ResultStructMetadataDef | ResultMetadataDef | undefined {
    return undefined;
  }
}

class QueryQueryIndex extends QueryQuery {
  fieldDef: TurtleDef;
  stages: RefToField[][] = [];

  constructor(
    fieldDef: TurtleDef,
    parent: QueryStruct,
    stageWriter: StageWriter | undefined,
    isJoinedSubquery: boolean
  ) {
    super(fieldDef, parent, stageWriter, isJoinedSubquery);
    this.fieldDef = fieldDef;
    this.fieldsToStages();
  }

  fieldsToStages() {
    const indexSeg = this.firstSegment as IndexSegment;
    if (this.parent.dialect.dontUnionIndex) {
      this.stages = [indexSeg.indexFields];
      return;
    }

    // Collect the field references by unique path, the final
    // index will be a union indexes from each unique path
    const stageMap: Record<string, RefToField[]> = {};
    for (const fref of indexSeg.indexFields) {
      if (fref.path.length > 1) {
        const stageRoot = pathToCol(fref.path.slice(0, fref.path.length - 1));
        const stage = stageMap[stageRoot];
        if (stage === undefined) {
          const f = this.parent.nameMap.get(fref.path[0]);
          if (
            f instanceof QueryFieldStruct &&
            f.fieldDef.join === 'many' &&
            f.fieldDef.fields.length > 1
          ) {
            const toStage = [fref];
            stageMap[stageRoot] = toStage;
            this.stages.push(toStage);
            continue;
          }
        } else {
          stage.push(fref);
          continue;
        }
      }
      if (this.stages[0] === undefined) {
        this.stages[0] = [];
      }
      this.stages[0].push(fref);
    }
  }

  expandFields(_resultStruct: FieldInstanceResult) {}

  generateSQL(stageWriter: StageWriter): string {
    const indexSeg = this.firstSegment as IndexSegment;
    const outputStageNames: string[] = [];
    for (const fields of this.stages) {
      const q = new QueryQueryIndexStage(
        {
          ...this.fieldDef,
          pipeline: [
            {
              ...indexSeg,
              indexFields: fields,
            },
          ],
        },
        this.parent,
        stageWriter,
        this.isJoinedSubquery
      );
      q.prepare(stageWriter);
      const lastStageName = q.generateSQL(stageWriter);
      outputStageNames.push(lastStageName);
    }
    if (outputStageNames.length === 1) {
      this.resultStage = outputStageNames[0];
    } else {
      this.resultStage = stageWriter.addStage(
        outputStageNames.map(n => `SELECT * FROM ${n}\n`).join(' UNION ALL \n')
      );
    }
    return this.resultStage;
  }

  /**
   * All Indexes have the same output schema.
   *   fieldName is deprecated, dots in fieldName may or may not be join nodes
   *   fieldPath is a URL encoded slash separated path
   */
  getResultStructDef(): QueryResultDef {
    const ret: StructDef = {
      type: 'query_result',
      name: this.resultStage || 'result',
      dialect: this.parent.dialect.name,
      fields: [
        {type: 'string', name: 'fieldName'},
        {type: 'string', name: 'fieldPath'},
        {type: 'string', name: 'fieldValue'},
        {type: 'string', name: 'fieldType'},
        {type: 'number', name: 'weight', numberType: 'integer'},
      ],
      connection: this.parent.connectionName,
    };
    if (this.parent.structDef.modelAnnotation) {
      ret.modelAnnotation = this.parent.structDef.modelAnnotation;
    }
    return ret;
  }
}

/*
 * The input to a query will always be a QueryStruct. A QueryStruct is also a namespace
 * for tracking joins, and so a QueryFieldStruct is a QueryField which has a QueryStruct.
 *
 * This is a result of it being impossible to inherit both from QueryStruct and QueryField
 * for array and record types.
 */
class QueryFieldStruct extends QueryField {
  queryStruct: QueryStruct;
  fieldDef: JoinFieldDef;
  constructor(
    jfd: JoinFieldDef,
    sourceArguments: Record<string, Argument> | undefined,
    parent: QueryStruct,
    prepareResultOptions: PrepareResultOptions,
    referenceId?: string
  ) {
    super(jfd, parent, referenceId);
    this.fieldDef = jfd;
    this.queryStruct = new QueryStruct(
      jfd,
      sourceArguments,
      {struct: parent},
      prepareResultOptions
    );
  }

  /*
   * Proxy the field-like methods that QueryStruct implements, eventually
   * those probably should be in here ... I thought this would be important
   * but maybe it isn't, it doesn't fix the problem I am working on ...
   */

  getJoinableParent() {
    return this.queryStruct.getJoinableParent();
  }

  getFullOutputName() {
    return this.queryStruct.getFullOutputName();
  }

  includeInWildcard(): boolean {
    return this.isAtomic();
  }
}

/** Structure object as it is used to build a query */
class QueryStruct {
  parent: QueryStruct | undefined;
  model: QueryModel;
  nameMap = new Map<string, QueryField>();
  pathAliasMap: Map<string, string>;
  dialect: Dialect;
  connectionName: string;
  recordAlias?: string;

  constructor(
    public structDef: StructDef,
    readonly sourceArguments: Record<string, Argument> | undefined,
    parent: ParentQueryStruct | ParentQueryModel,
    readonly prepareResultOptions: PrepareResultOptions
  ) {
    this.setParent(parent);

    if ('model' in parent) {
      this.model = parent.model;
      this.pathAliasMap = new Map<string, string>();
      if (isSourceDef(structDef)) {
        this.connectionName = structDef.connection;
      } else {
        throw new Error('All root StructDefs should be a baseTable');
      }
    } else {
      this.model = this.getModel();
      this.pathAliasMap = this.root().pathAliasMap;
      this.connectionName = this.root().connectionName;
    }

    this.dialect = getDialect(this.findFirstDialect());
    this.addFieldsFromFieldList(structDef.fields);
  }

  private _modelTag: Tag | undefined = undefined;
  modelCompilerFlags(): Tag {
    if (this._modelTag === undefined) {
      const annotation = this.structDef.modelAnnotation;
      const {tag} = annotationToTag(annotation, {prefix: /^##!\s*/});
      this._modelTag = tag;
    }
    return this._modelTag;
  }

  protected findFirstDialect(): string {
    if (isSourceDef(this.structDef)) {
      return this.structDef.dialect;
    }
    if (this.parent) {
      return this.parent.findFirstDialect();
    }
    throw new Error('Cannot create QueryStruct from record with model parent');
  }

  informOfAliasValue(av: string): void {
    this.recordAlias = av;
  }

  maybeEmitParameterizedSourceUsage() {
    if (isSourceDef(this.structDef)) {
      const paramsAndArgs = {
        ...this.structDef.parameters,
        ...this.structDef.arguments,
      };
      if (Object.values(paramsAndArgs).length === 0) return;
      this.eventStream?.emit('parameterized-source-compiled', {
        parameters: paramsAndArgs,
      });
    }
  }

  private resolveParentParameterReferences(param: Parameter): Parameter {
    return {
      ...param,
      value:
        param.value === null
          ? null
          : exprMap(param.value, frag => {
              if (frag.node === 'parameter') {
                if (this.parent === undefined) {
                  throw new Error(
                    'No parent from which to retrieve parameter value'
                  );
                }
                const resolved1 = this.parent.arguments()[frag.path[0]];
                const resolved2 =
                  this.parent.resolveParentParameterReferences(resolved1);
                if (resolved2.value === null) {
                  throw new Error('Invalid parameter value');
                } else {
                  return resolved2.value;
                }
              }
              return frag;
            }),
    };
  }

  private _arguments: Record<string, Argument> | undefined = undefined;
  arguments(): Record<string, Argument> {
    if (this._arguments !== undefined) {
      return this._arguments;
    }
    this._arguments = {};
    if (isSourceDef(this.structDef)) {
      // First, copy over all parameters, to get default values
      const params = this.structDef.parameters ?? {};
      for (const parameterName in params) {
        this._arguments[parameterName] = params[parameterName];
      }
      // Then, copy over arguments to override default values
      const args = {...this.structDef.arguments, ...this.sourceArguments};
      for (const parameterName in args) {
        const orig = args[parameterName];
        this._arguments[parameterName] =
          this.resolveParentParameterReferences(orig);
      }
    }
    return this._arguments;
  }

  private addFieldsFromFieldList(fields: FieldDef[]) {
    for (const field of fields) {
      const as = getIdentifier(field);

      if (field.type === 'turtle') {
        this.addFieldToNameMap(
          as,
          QueryQuery.makeQuery(field, this, undefined, false)
        );
      } else if (isAtomic(field) || isJoinedSource(field)) {
        this.addFieldToNameMap(as, this.makeQueryField(field));
      } else {
        throw new Error('mtoy did nit add field');
      }
    }
    // if we don't have distinct key yet for this struct, add it.
    if (!this.nameMap.has('__distinct_key')) {
      this.addFieldToNameMap(
        '__distinct_key',
        new QueryFieldDistinctKey(
          {type: 'string', name: '__distinct_key'},
          this
        )
      );
    }
  }

  // generate unique string for the alias.
  // return a string that can be used to represent the full
  //  join path to a struct.
  getAliasIdentifier(): string {
    const path = this.getFullOutputName();
    const ret: string | undefined = this.pathAliasMap.get(path);

    // make a unique alias name
    if (ret === undefined) {
      const aliases = Array.from(this.pathAliasMap.values());
      const base = identifierNormalize(getIdentifier(this.structDef));
      let name = `${base}_0`;
      let n = 1;
      while (aliases.includes(name) && n < 1000) {
        n++;
        name = `${base}_${n}`;
      }
      if (n < 1000) {
        this.pathAliasMap.set(path, name);
        return name;
      } else {
        throw new Error('Internal Error: cannot create unique alias name');
      }

      // get the malloy name for this struct (will include a trailing dot)
      // return this.getFullOutputName().replace(/\.$/, "").replace(/\./g, "_o_");
    } else {
      return ret;
    }
  }

  getSQLIdentifier(): string {
    if (this.unnestWithNumbers() && this.parent !== undefined) {
      const x =
        this.parent.getSQLIdentifier() +
        '.' +
        getIdentifier(this.structDef) +
        `[${this.getIdentifier()}.__row_id]`;
      return x;
    } else {
      return this.getIdentifier();
    }
  }

  sqlChildReference(
    name: string,
    expand: {result: FieldInstanceResult; field: QueryField} | undefined
  ) {
    let parentRef = this.getSQLIdentifier();
    if (expand && isAtomic(this.structDef) && hasExpression(this.structDef)) {
      if (!this.parent) {
        throw new Error(`Cannot expand reference to ${name} without parent`);
      }
      parentRef = expand.field.exprToSQL(
        expand.result,
        this.parent,
        this.structDef.e
      );
    }
    let refType: FieldReferenceType = 'table';
    if (this.structDef.type === 'record') {
      refType = 'record';
    } else if (this.structDef.type === 'array') {
      refType =
        this.structDef.elementTypeDef.type === 'record_element'
          ? 'array[record]'
          : 'array[scalar]';
    } else if (this.structDef.type === 'nest_source') {
      refType = 'nest source';
    }
    const child = this.getChildByName(name);
    const childType = child?.fieldDef.type || 'unknown';
    return this.dialect.sqlFieldReference(parentRef, refType, name, childType);
  }

  // return the name of the field in SQL
  getIdentifier(): string {
    // if it is the root table, use provided alias if we have one.
    if (isBaseTable(this.structDef)) {
      return 'base';
    }

    // If this is a synthetic column, return the expression rather than the name
    // because the name will not exist. Only for records because the other types
    // will have joins and thus be in the namespace. We can't compute it here
    // because we don't have access to the Query to call exprToSQL.
    if (this.structDef.type === 'record' && hasExpression(this.structDef)) {
      if (this.recordAlias) {
        return this.recordAlias;
      }
      throw new Error('INTERNAL ERROR, record field alias not pre-computed');
    }

    // if this is an inline object, include the parents alias.
    if (this.structDef.type === 'record' && this.parent) {
      return this.parent.sqlChildReference(
        getIdentifier(this.structDef),
        undefined
      );
    }
    // we are somewhere in the join tree.  Make sure the alias is unique.
    return this.getAliasIdentifier();
  }

  // return the name of the field in Malloy
  getFullOutputName(): string {
    if (this.parent) {
      return (
        this.parent.getFullOutputName() + getIdentifier(this.structDef) + '.'
      );
    } else {
      return '';
    }
  }

  needsSymetricCalculation(resultSet: FieldInstanceResult): boolean {
    const joinName = this.getJoinableParent().getIdentifier();
    const join = resultSet.root().joins.get(joinName);
    if (join) {
      return !join.leafiest;
    }
    throw new Error(`Join ${joinName} not found in result set`);
  }

  unnestWithNumbers(): boolean {
    return this.dialect.unnestWithNumbers && this.structDef.type === 'array';
  }

  getJoinableParent(): QueryStruct {
    // if it is inline it should always have a parent
    if (this.structDef.type === 'record') {
      if (this.parent) {
        return this.parent.getJoinableParent();
      } else {
        throw new Error('Internal Error: inline struct cannot be root');
      }
    }
    return this;
  }

  addFieldToNameMap(as: string, n: QueryField) {
    if (this.nameMap.has(as)) {
      throw new Error(`Redefinition of ${as}`);
    }
    this.nameMap.set(as, n);
  }

  /** the the primary key or throw an error. */
  getPrimaryKeyField(fieldDef: FieldDef): QueryBasicField {
    let pk;
    if ((pk = this.primaryKey())) {
      return pk;
    } else {
      throw new Error(`Missing primary key for ${fieldDef}`);
    }
  }

  /**
   * called after all structure has been loaded.  Examine this structure to see
   * if if it is based on a query and if it is, add the output fields (unless
   * they exist) to the structure.
   */
  resolveQueryFields() {
    if (this.structDef.type === 'query_source') {
      const resultStruct = this.model
        .loadQuery(this.structDef.query, undefined, this.prepareResultOptions)
        .structs.pop();

      // should never happen.
      if (!resultStruct) {
        throw new Error("Internal Error, query didn't produce a struct");
      }

      const structDef = {...this.structDef};
      for (const f of resultStruct.fields) {
        const as = getIdentifier(f);
        if (!this.nameMap.has(as)) {
          structDef.fields.push(f);
          this.nameMap.set(as, this.makeQueryField(f));
        }
      }
      this.structDef = structDef;
      if (!this.structDef.primaryKey && resultStruct.primaryKey) {
        this.structDef.primaryKey = resultStruct.primaryKey;
      }
    }
    for (const [, v] of this.nameMap) {
      if (v instanceof QueryFieldStruct) {
        v.queryStruct.resolveQueryFields();
      }
    }
  }

  getModel(): QueryModel {
    if (this.model) {
      return this.model;
    } else {
      if (this.parent === undefined) {
        throw new Error(
          'Expected this query struct to have a parent, as no model was present.'
        );
      }
      return this.parent.getModel();
    }
  }

  get eventStream(): EventStream | undefined {
    return this.getModel().eventStream;
  }

  setParent(parent: ParentQueryStruct | ParentQueryModel) {
    if ('struct' in parent) {
      this.parent = parent.struct;
    }
    if ('model' in parent) {
      this.model = parent.model;
    } else {
      this.model = this.getModel();
    }
  }

  /** makes a new queryable field object from a fieldDef */
  makeQueryField(field: FieldDef, referenceId?: string): QueryField {
    switch (field.type) {
      case 'array':
      case 'record':
      case 'query_source':
      case 'table':
      case 'sql_select':
      case 'composite':
        return new QueryFieldStruct(
          field,
          undefined,
          this,
          this.prepareResultOptions
        );
      case 'string':
        return new QueryFieldString(field, this, referenceId);
      case 'date':
        return new QueryFieldDate(field, this, referenceId);
      case 'timestamp':
        return new QueryFieldTimestamp(field, this, referenceId);
      case 'number':
        return new QueryFieldNumber(field, this, referenceId);
      case 'boolean':
        return new QueryFieldBoolean(field, this, referenceId);
      case 'json':
        return new QueryFieldJSON(field, this, referenceId);
      case 'sql native':
        return new QueryFieldUnsupported(field, this, referenceId);
      case 'turtle':
        return QueryQuery.makeQuery(field, this, undefined, false);
      default:
        throw new Error(
          `unknown field definition ${(JSON.stringify(field), undefined, 2)}`
        );
    }
  }

  structSourceSQL(stageWriter: StageWriter): string {
    switch (this.structDef.type) {
      case 'table':
        return this.dialect.quoteTablePath(this.structDef.tablePath);
      case 'composite':
        // TODO: throw an error here; not simple because we call into this
        // code currently before the composite source is resolved in some cases
        return '{COMPOSITE SOURCE}';
      case 'finalize':
        return this.structDef.name;
      case 'sql_select':
        return `(${this.structDef.selectStr})`;
      case 'nest_source':
        return this.structDef.pipeSQL;
      case 'query_source': {
        // cache derived table.
        if (
          this.prepareResultOptions?.replaceMaterializedReferences &&
          shouldMaterialize(this.structDef.query.annotation)
        ) {
          return stageWriter.addMaterializedQuery(
            getIdentifier(this.structDef),
            this.structDef.query,
            this.prepareResultOptions?.materializedTablePrefix
          );
        } else {
          // returns the stage name.
          return this.model.loadQuery(
            this.structDef.query,
            stageWriter,
            this.prepareResultOptions,
            false,
            true // this is an intermediate stage.
          ).lastStageName;
        }
      }
      default:
        throw new Error(
          `Cannot create SQL StageWriter from '${getIdentifier(
            this.structDef
          )}' type '${this.structDef.type}`
        );
    }
  }

  root(): QueryStruct {
    return this.parent ? this.parent.root() : this;
  }

  primaryKey(): QueryBasicField | undefined {
    if (isSourceDef(this.structDef) && this.structDef.primaryKey) {
      return this.getDimensionByName([this.structDef.primaryKey]);
    } else {
      return undefined;
    }
  }

  getChildByName(name: string): QueryField | undefined {
    return this.nameMap.get(name);
  }

  /** convert a path into a field reference */
  getFieldByName(path: string[]): QueryField {
    let found: QueryField | undefined = undefined;
    let lookIn = this as QueryStruct | undefined;
    let notFound = path[0];
    for (const n of path) {
      found = lookIn?.getChildByName(n);
      if (!found) {
        notFound = n;
        break;
      }
      lookIn =
        found instanceof QueryFieldStruct ? found.queryStruct : undefined;
    }
    if (found === undefined) {
      const pathErr = path.length > 1 ? ` in ${path.join('.')}` : '';
      throw new Error(`${notFound} not found${pathErr}`);
    }
    return found;
  }

  // structs referenced in queries are converted to fields.
  getQueryFieldByName(name: string[]): QueryField {
    const field = this.getFieldByName(name);
    if (field instanceof QueryFieldStruct) {
      throw new Error(`Cannot reference ${name.join('.')} as a scalar'`);
    }
    return field;
  }

  getQueryFieldReference(
    path: string[],
    annotation: Annotation | undefined
  ): QueryField {
    const field = this.getFieldByName(path);
    if (annotation) {
      if (field.parent === undefined) {
        throw new Error(
          'Inconcievable, field reference to orphaned query field'
        );
      }
      // Made a field object from the source, but the annotations were computed by the compiler
      // when it generated the reference, and has both the source and reference annotations included.
      if (field instanceof QueryFieldStruct) {
        const newDef = {...field.fieldDef, annotation};
        return new QueryFieldStruct(
          newDef,
          undefined,
          field.parent,
          {},
          field.referenceId
        );
      } else {
        const newDef = {...field.fieldDef, annotation};
        return field.parent.makeQueryField(newDef, field.referenceId);
      }
    }
    return field;
  }

  getDimensionOrMeasureByName(name: string[]) {
    const field = this.getFieldByName(name);
    if (!field.isAtomic()) {
      throw new Error(`${name} is not an atomic field? Inconceivable!`);
    }
    return field;
  }

  /** returns a query object for the given name */
  getDimensionByName(name: string[]): QueryBasicField {
    const field = this.getFieldByName(name);

    if (isBasicScalar(field)) {
      return field;
    }
    throw new Error(`${name} is not an atomic scalar field? Inconceivable!`);
  }

  /** returns a query object for the given name */
  getStructByName(name: string[]): QueryStruct {
    if (name.length === 0) {
      return this;
    }
    const struct = this.getFieldByName(name);
    if (struct instanceof QueryFieldStruct) {
      return struct.queryStruct;
    }
    throw new Error(`Error: Path to structure not found '${name.join('.')}'`);
  }

  getDistinctKey(): QueryBasicField {
    if (this.structDef.type !== 'record') {
      return this.getDimensionByName(['__distinct_key']);
    } else if (this.parent) {
      return this.parent.getDistinctKey();
    } else {
      throw new Error('Asking a record for a primary key? Inconceivable!');
    }
  }

  applyStructFiltersToTurtleDef(
    turtleDef: TurtleDef | TurtleDefPlus
  ): TurtleDef {
    let pipeline = turtleDef.pipeline;
    const annotation = turtleDef.annotation;

    const addedFilters = (turtleDef as TurtleDefPlus).filterList || [];
    pipeline = structuredClone(pipeline);
    pipeline[0].filterList = addedFilters.concat(
      pipeline[0].filterList || [],
      isSourceDef(this.structDef) ? this.structDef.filterList || [] : []
    );

    const flatTurtleDef: TurtleDef = {
      type: 'turtle',
      name: turtleDef.name,
      pipeline,
      annotation,
      location: turtleDef.location,
    };
    return flatTurtleDef;
  }
}

/** the resulting SQL and the shape of the data at each stage of the pipeline */
interface QueryResults {
  lastStageName: string;
  stageWriter: StageWriter;
  structs: SourceDef[];
  malloy: string;
  connectionName: string;
}

// const exploreSearchSQLMap = new Map<string, string>();

/** start here */
export class QueryModel {
  dialect: Dialect = new StandardSQLDialect();
  // dialect: Dialect = new PostgresDialect();
  modelDef: ModelDef | undefined = undefined;
  structs = new Map<string, QueryStruct>();
  constructor(
    modelDef: ModelDef | undefined,
    readonly eventStream?: EventStream
  ) {
    if (modelDef) {
      this.loadModelFromDef(modelDef);
    }
  }

  loadModelFromDef(modelDef: ModelDef): void {
    this.modelDef = modelDef;
    for (const s of Object.values(this.modelDef.contents)) {
      let qs;
      if (isSourceDef(s)) {
        qs = new QueryStruct(s, undefined, {model: this}, {});
        this.structs.set(getIdentifier(s), qs);
        qs.resolveQueryFields();
      } else if (s.type === 'query') {
        /* TODO */
      } else {
        throw new Error('Internal Error: Unknown structure type');
      }
    }
  }

  getStructByName(name: string): QueryStruct {
    const s = this.structs.get(name);
    if (s) {
      return s;
    }
    throw new Error(`Struct ${name} not found in model.`);
  }

  getStructFromRef(
    structRef: StructRef,
    sourceArguments: Record<string, Argument> | undefined,
    prepareResultOptions?: PrepareResultOptions
  ): QueryStruct {
    prepareResultOptions ??= {};
    if (typeof structRef === 'string') {
      const ret = this.getStructByName(structRef);
      if (sourceArguments !== undefined) {
        return new QueryStruct(
          ret.structDef,
          sourceArguments,
          ret.parent ?? {model: this},
          prepareResultOptions
        );
      }
      return ret;
    }
    return new QueryStruct(
      structRef,
      sourceArguments,
      {model: this},
      prepareResultOptions
    );
  }

  loadQuery(
    query: Query,
    stageWriter: StageWriter | undefined,
    prepareResultOptions?: PrepareResultOptions,
    emitFinalStage = false,
    isJoinedSubquery = false
  ): QueryResults {
    const malloy = '';

    if (!stageWriter) {
      stageWriter = new StageWriter(true, undefined);
    }

    const turtleDef: TurtleDefPlus = {
      type: 'turtle',
      name: 'ignoreme',
      pipeline: query.pipeline,
      filterList: query.filterList,
    };

    const structRef = query.compositeResolvedSourceDef ?? query.structRef;

    const q = QueryQuery.makeQuery(
      turtleDef,
      this.getStructFromRef(
        structRef,
        query.sourceArguments,
        prepareResultOptions
      ),
      stageWriter,
      isJoinedSubquery
    );

    const ret = q.generateSQLFromPipeline(stageWriter);
    if (emitFinalStage && q.parent.dialect.hasFinalStage) {
      // const fieldNames: string[] = [];
      // for (const f of ret.outputStruct.fields) {
      //   fieldNames.push(getIdentifier(f));
      // }
      const fieldNames: string[] = [];
      for (const f of ret.outputStruct.fields) {
        if (isAtomic(f)) {
          const quoted = q.parent.dialect.sqlMaybeQuoteIdentifier(f.name);
          fieldNames.push(quoted);
        }
      }
      // const fieldNames = getAtomicFields(ret.outputStruct).map(fieldDef =>
      //   q.parent.dialect.sqlMaybeQuoteIdentifier(fieldDef.name)
      // );
      ret.lastStageName = stageWriter.addStage(
        q.parent.dialect.sqlFinalStage(ret.lastStageName, fieldNames)
      );
    }
    return {
      lastStageName: ret.lastStageName,
      malloy,
      stageWriter,
      structs: [ret.outputStruct],
      connectionName: q.parent.connectionName,
    };
  }

  addDefaultRowLimit(
    query: Query,
    defaultRowLimit?: number
  ): {query: Query; addedDefaultRowLimit?: number} {
    const nope = {query, addedDefaultRowLimit: undefined};
    if (defaultRowLimit === undefined) return nope;
    const lastSegment = query.pipeline[query.pipeline.length - 1];
    if (lastSegment.type === 'raw') return nope;
    if (lastSegment.limit !== undefined) return nope;
    return {
      query: {
        ...query,
        pipeline: [
          ...query.pipeline.slice(0, -1),
          {
            ...lastSegment,
            limit: defaultRowLimit,
          },
        ],
      },
      addedDefaultRowLimit: defaultRowLimit,
    };
  }

  compileQuery(
    query: Query,
    prepareResultOptions?: PrepareResultOptions,
    finalize = true
  ): CompiledQuery {
    let newModel: QueryModel | undefined;
    const addDefaultRowLimit = this.addDefaultRowLimit(
      query,
      prepareResultOptions?.defaultRowLimit
    );
    query = addDefaultRowLimit.query;
    const addedDefaultRowLimit = addDefaultRowLimit.addedDefaultRowLimit;
    const m = newModel || this;
    const ret = m.loadQuery(
      query,
      undefined,
      prepareResultOptions,
      finalize,
      false
    );
    const structRef = query.compositeResolvedSourceDef ?? query.structRef;
    const sourceExplore =
      typeof structRef === 'string'
        ? structRef
        : structRef.as || structRef.name;
    // LTNote:  I don't understand why this might be here.  It should have happened in loadQuery...
    if (finalize && this.dialect.hasFinalStage) {
      ret.lastStageName = ret.stageWriter.addStage(
        // note this will be broken on duckDB waiting on a real fix.
        this.dialect.sqlFinalStage(ret.lastStageName, [])
      );
    }
    return {
      lastStageName: ret.lastStageName,
      malloy: ret.malloy,
      sql: ret.stageWriter.generateSQLStages(),
      dependenciesToMaterialize: ret.stageWriter.dependenciesToMaterialize,
      materialization: shouldMaterialize(query.annotation)
        ? buildQueryMaterializationSpec(
            query.location?.url,
            query.name,
            prepareResultOptions?.materializedTablePrefix
          )
        : undefined,
      structs: ret.structs,
      sourceExplore,
      sourceFilters: query.filterList,
      queryName: query.name,
      connectionName: ret.connectionName,
      annotation: query.annotation,
      queryTimezone: ret.structs[0].queryTimezone,
      defaultRowLimitAdded: addedDefaultRowLimit,
    };
  }

  exploreSearchSQLMap = new Map();

  async searchIndex(
    connection: Connection,
    explore: string,
    searchValue: string,
    limit = 1000,
    searchField: string | undefined = undefined
  ): Promise<SearchIndexResult[] | undefined> {
    if (!connection.canPersist()) {
      return undefined;
    }
    // make a search index if one isn't modelled.
    const struct = this.getStructByName(explore);
    let indexStar: RefToField[] = [];
    for (const [fn, fv] of struct.nameMap) {
      if (isScalarField(fv) && fv.includeInWildcard()) {
        indexStar.push({type: 'fieldref', path: [fn]});
      }
    }
    indexStar = indexStar.sort((a, b) => a.path[0].localeCompare(b.path[0]));
    const indexQuery: Query = {
      structRef: explore,
      pipeline: [
        {
          type: 'index',
          indexFields: indexStar,
          sample: struct.dialect.defaultSampling,
        },
      ],
    };
    const fieldNameColumn = struct.dialect.sqlMaybeQuoteIdentifier('fieldName');
    const fieldPathColumn = struct.dialect.sqlMaybeQuoteIdentifier('fieldPath');
    const fieldValueColumn =
      struct.dialect.sqlMaybeQuoteIdentifier('fieldValue');
    const fieldTypeColumn = struct.dialect.sqlMaybeQuoteIdentifier('fieldType');
    const weightColumn = struct.dialect.sqlMaybeQuoteIdentifier('weight');

    // if we've compiled the SQL before use it otherwise
    let sqlPDT = this.exploreSearchSQLMap.get(explore);
    if (sqlPDT === undefined) {
      sqlPDT = this.compileQuery(indexQuery, undefined, false).sql;
      this.exploreSearchSQLMap.set(explore, sqlPDT);
    }

    let query = `SELECT ${
      this.dialect.limitClause === 'top' ? `TOP ${limit}` : ''
    }
              ${fieldNameColumn},
              ${fieldPathColumn},
              ${fieldValueColumn},
              ${fieldTypeColumn},
              ${weightColumn},
              CASE WHEN lower(${fieldValueColumn}) LIKE lower(${generateSQLStringLiteral(
                searchValue + '%'
              )}) THEN 1 ELSE 0 END as match_first
            FROM  ${await connection.manifestTemporaryTable(sqlPDT)}
            WHERE lower(${fieldValueColumn}) LIKE lower(${generateSQLStringLiteral(
              '%' + searchValue + '%'
            )}) ${
              searchField !== undefined
                ? ` AND ${fieldNameColumn} = '` + searchField + "' \n"
                : ''
            }
            ORDER BY CASE WHEN lower(${fieldValueColumn}) LIKE  lower(${generateSQLStringLiteral(
              searchValue + '%'
            )}) THEN 1 ELSE 0 END DESC, ${weightColumn} DESC
           ${this.dialect.limitClause === 'limit' ? `LIMIT ${limit}\n` : ''}
          `;
    if (struct.dialect.hasFinalStage) {
      query = `WITH __stage0 AS(\n${query}\n)\n${struct.dialect.sqlFinalStage(
        '__stage0',
        [
          fieldNameColumn,
          fieldPathColumn,
          fieldValueColumn,
          fieldTypeColumn,
          weightColumn,
          'match_first',
        ]
      )}`;
    }
    const result = await connection.runSQL(query, {
      rowLimit: 1000,
    });
    return result.rows as unknown as SearchIndexResult[];
  }
}
