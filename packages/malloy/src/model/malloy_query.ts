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

import {Dialect, DialectFieldList, getDialect} from '../dialect';
import {StandardSQLDialect} from '../dialect/standardsql/standardsql';
import {
  AggregateFragment,
  AggregateFunctionType,
  Annotation,
  CompiledQuery,
  DialectFragment,
  Expr,
  expressionIsAggregate,
  expressionIsAnalytic,
  expressionIsCalculation,
  expressionIsScalar,
  FieldAtomicDef,
  FieldDateDef,
  FieldDef,
  FieldFragment,
  FieldTimestampDef,
  Filtered,
  FilterExpression,
  FilterFragment,
  FunctionCallFragment,
  FunctionOverloadDef,
  FunctionParameterDef,
  getIdentifier,
  getPhysicalFields,
  hasExpression,
  IndexFieldDef,
  IndexSegment,
  isAggregateFragment,
  isApplyFragment,
  isApplyValue,
  isAsymmetricFragment,
  isDialectFragment,
  isLiteral,
  isFieldFragment,
  isFilterFragment,
  isFunctionCallFragment,
  isFunctionParameterFragment,
  isIndexSegment,
  isJoinOn,
  isOutputFieldFragment,
  isParameterFragment,
  isPhysical,
  isQuerySegment,
  isRawSegment,
  isSpreadFragment,
  isSQLExpressionFragment,
  isUngroupFragment,
  JoinRelationship,
  ModelDef,
  OrderBy,
  OutputFieldFragment,
  Parameter,
  ParameterFragment,
  PipeSegment,
  Query,
  QueryFieldDef,
  QuerySegment,
  RefToField,
  ResultMetadataDef,
  ResultStructMetadataDef,
  SearchIndexResult,
  SourceReferenceFragment,
  SegmentFieldDef,
  SpreadFragment,
  SQLExpressionFragment,
  SqlStringFragment,
  StructDef,
  StructRef,
  TurtleDef,
  UngroupFragment,
} from './malloy_types';

import {Connection} from '../runtime_types';
import {
  AndChain,
  exprMap,
  generateHash,
  indent,
  joinWith,
  range,
} from './utils';
import {QueryInfo} from '../dialect/dialect';

interface TurtleDefPlus extends TurtleDef, Filtered {}

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

// Track the times we might need a unique key
type UniqueKeyPossibleUse = AggregateFunctionType | 'generic_aggregate';

class UniqueKeyUse extends Set<UniqueKeyPossibleUse> {
  add_use(k: UniqueKeyPossibleUse | undefined) {
    if (k !== undefined) {
      return this.add(k);
    }
  }

  hasAsymetricFunctions(): boolean {
    return this.has('sum') || this.has('avg') || this.has('count');
  }
}

class StageWriter {
  withs: string[] = [];
  udfs: string[] = [];
  pdts: string[] = [];
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
    sql += dialect.sqlCreateFunctionCombineLastStage(lastStageName, structDef);

    const id = `${dialect.udfPrefix}${this.root().udfs.length}`;
    sql = dialect.sqlCreateFunction(id, sql);
    this.root().udfs.push(sql);
    return id;
  }

  addPDT(baseName: string, dialect: Dialect): string {
    const sql =
      this.combineStages(false).sql + this.withs[this.withs.length - 1];
    const tableName = 'scratch.' + baseName + generateHash(sql);
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
        structDef
      );
    } else {
      return (
        this.combineStages(true).sql +
        dialect.sqlCreateFunctionCombineLastStage(
          this.getName(this.withs.length - 1),
          structDef
        )
      );
    }
  }
}

type QuerySomething = QueryField | QueryStruct | QueryTurtle;

// type QueryNodeType =
//   | "abstract"
//   | "dimension"
//   | "measure"
//   | "query"
//   | "turtle"
//   | "struct";

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
  constructor(public fieldDef: FieldDef) {}

  getIdentifier() {
    return getIdentifier(this.fieldDef);
  }

  getChildByName(_name: string): QuerySomething | undefined {
    return undefined;
  }
}

class QueryField extends QueryNode {
  fieldDef: FieldDef;
  parent: QueryStruct;

  constructor(fieldDef: FieldDef, parent: QueryStruct) {
    super(fieldDef);
    this.parent = parent;
    this.fieldDef = fieldDef;
  }

  uniqueKeyPossibleUse(): UniqueKeyPossibleUse | undefined {
    return undefined;
  }

  getJoinableParent(): QueryStruct {
    // if it is inline it should always have a parent
    const parent = this.parent;
    if (parent.fieldDef.structRelationship.type === 'inline') {
      if (parent) {
        return parent.getJoinableParent();
      } else {
        throw new Error('Internal Error: inline struct cannot be root');
      }
    }
    return parent;
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
    expr: FieldFragment,
    state: GenerateState
  ): string {
    // find the structDef and return the path to the field...
    const field = context.getFieldByName(expr.path) as QueryField;
    if (hasExpression(field.fieldDef)) {
      const ret = this.generateExpressionFromExpr(
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
    frag: OutputFieldFragment,
    _state: GenerateState
  ): string {
    return `(${resultSet.getField(frag.name).getAnalyticalSQL(false)})`;
  }

  generateSQLExpression(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    frag: SQLExpressionFragment,
    state: GenerateState
  ): string {
    return this.generateExpressionFromExpr(resultSet, context, frag.e, state);
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
    const paramMap = this.getParameterMap(overload, args.length);
    if (overload.dialect[dialect] === undefined) {
      throw new Error(`Function is not defined for dialect ${dialect}`);
    }
    return exprMap(overload.dialect[dialect].e, fragment => {
      if (typeof fragment === 'string') {
        return [fragment];
      } else if (fragment.type === 'spread') {
        const param = fragment.e[0];
        if (
          fragment.e.length !== 1 ||
          typeof param === 'string' ||
          param.type !== 'function_parameter'
        ) {
          throw new Error(
            'Invalid function definition. Argument to spread must be a function parameter.'
          );
        }
        const entry = paramMap.get(param.name);
        if (entry === undefined) {
          return [fragment];
        } else {
          return joinWith(
            entry.argIndexes.map(argIndex => args[argIndex]),
            ','
          );
        }
      } else if (fragment.type === 'function_parameter') {
        const entry = paramMap.get(fragment.name);
        if (entry === undefined) {
          return [fragment];
        } else if (entry.param.isVariadic) {
          const spread = joinWith(
            entry.argIndexes.map(argIndex => args[argIndex]),
            ','
          );
          return ['[', ...spread, ']'];
        } else {
          return args[entry.argIndexes[0]];
        }
      } else if (fragment.type === 'aggregate_order_by') {
        return orderBy ? [` ${orderBy}`] : [];
      } else if (fragment.type === 'aggregate_limit') {
        return limit ? [` ${limit}`] : [];
      }
      return [fragment];
    });
  }

  generateFunctionCallExpression(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    frag: FunctionCallFragment,
    state: GenerateState
  ): string {
    const overload = frag.overload;
    const args = frag.args;
    const isSymmetric = frag.overload.isSymmetric ?? false;
    const distinctKey =
      expressionIsAggregate(overload.returnType.expressionType) &&
      !isSymmetric &&
      this.generateDistinctKeyIfNecessary(resultSet, context, frag.structPath);
    const aggregateOrderBy = frag.orderBy
      ? 'ORDER BY ' +
        frag.orderBy
          .map(ob => {
            const osql = this.generateDimFragment(
              resultSet,
              context,
              ob.e,
              state
            );
            const dirsql =
              ob.dir === 'asc' ? ' ASC' : ob.dir === 'desc' ? ' DESC' : '';
            return `${osql}${dirsql}`;
          })
          .join(', ')
      : undefined;
    const aggregateLimit = frag.limit ? `LIMIT ${frag.limit}` : undefined;
    if (distinctKey) {
      if (!context.dialect.supportsAggDistinct) {
        throw new Error(
          `Asymmetric aggregates are not supported for custom functions in ${context.dialect.name}.`
        );
      }
      const argsExpressions = args.map(arg => {
        return this.generateDimFragment(resultSet, context, arg, state);
      });
      return context.dialect.sqlAggDistinct(
        distinctKey,
        argsExpressions,
        valNames => {
          const funcCall = this.expandFunctionCall(
            context.dialect.name,
            overload,
            valNames.map(v => [v]),
            aggregateOrderBy,
            aggregateLimit
          );
          return this.generateExpressionFromExpr(
            resultSet,
            context,
            funcCall,
            state
          );
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
            const param = overload.params[index];
            // TODO technically this should probably look at _which_ allowed param type was matched
            // for this argument and see if that type is at most constant... but we lose type information
            // by this point in the compilation, so that info would have to be passed into the func call
            // fragment.
            return param.allowedTypes.every(t => isLiteral(t.evalSpace))
              ? arg
              : [this.generateDimFragment(resultSet, context, arg, state)];
          })
        : args;
      const funcCall: Expr = this.expandFunctionCall(
        context.dialect.name,
        overload,
        mappedArgs,
        aggregateOrderBy,
        aggregateLimit
      );

      if (expressionIsAnalytic(overload.returnType.expressionType)) {
        const extraPartitions = (frag.partitionBy ?? []).map(outputName => {
          return `(${resultSet.getField(outputName).getAnalyticalSQL(false)})`;
        });
        // TODO probably need to pass in the function and arguments separately
        // in order to generate parameter SQL correctly in BQ re: partition
        return this.generateAnalyticFragment(
          resultSet,
          context,
          funcCall,
          overload,
          state,
          args,
          extraPartitions,
          aggregateOrderBy
        );
      }
      return this.generateExpressionFromExpr(
        resultSet,
        context,
        funcCall,
        state
      );
    }
  }

  generateSpread(
    _resultSet: FieldInstanceResult,
    _context: QueryStruct,
    _frag: SpreadFragment,
    _state: GenerateState
  ): string {
    throw new Error('Unexpanded spread encountered during SQL generation');
  }

  generateParameterFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: ParameterFragment,
    _state: GenerateState
  ): string {
    /*
      mtoy todo parameters and paths figure this out

    // find the structDef and return the path to the field...
    const param = context.parameters()[expr.path];
    if (isValueParameter(param)) {
      if (param.value) {
        return this.generateExpressionFromExpr(
          resultSet,
          context,
          param.value,
          state
        );
      }
    } else if (param.condition) {
      return this.generateExpressionFromExpr(
        resultSet,
        context,
        param.condition,
        state
      );
    }
    */
    throw new Error(`Can't generate SQL, no value for ${expr.path}`);
  }

  generateFilterFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: FilterFragment,
    state: GenerateState
  ): string {
    const allWhere = new AndChain(state.whereSQL);
    for (const cond of expr.filterList) {
      allWhere.add(
        this.generateExpressionFromExpr(
          resultSet,
          context,
          cond.expression,
          state.withWhere()
        )
      );
    }
    return this.generateExpressionFromExpr(
      resultSet,
      context,
      expr.e,
      state.withWhere(allWhere.sql())
    );
  }

  generateDimFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: Expr,
    state: GenerateState
  ): string {
    let dim = this.generateExpressionFromExpr(resultSet, context, expr, state);
    if (state.whereSQL) {
      dim = `CASE WHEN ${state.whereSQL} THEN ${dim} END`;
    }
    return dim;
  }

  generateUngroupedFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: UngroupFragment,
    state: GenerateState
  ): string {
    if (state.totalGroupSet !== -1) {
      throw new Error('Already in ALL.  Cannot nest within an all calcuation.');
    }

    let totalGroupSet;
    let ungroupSet: UngroupSet | undefined;

    if (expr.fields && expr.fields.length > 0) {
      const key = expr.fields.sort().join('|') + expr.type;
      ungroupSet = resultSet.ungroupedSets.get(key);
      if (ungroupSet === undefined) {
        throw new Error(`Internal Error, cannot find groupset with key ${key}`);
      }
      totalGroupSet = ungroupSet.groupSet;
    } else {
      totalGroupSet = resultSet.parent ? resultSet.parent.groupSet : 0;
    }

    const s = this.generateExpressionFromExpr(
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
    expr: AggregateFragment,
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
    expr: AggregateFragment,
    state: GenerateState
  ): string {
    const dimSQL = this.generateDimFragment(resultSet, context, expr.e, state);
    const f =
      expr.function === 'count_distinct'
        ? 'count(distinct '
        : expr.function + '(';
    return `${f}${dimSQL})`;
  }

  generateAvgFragment(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: AggregateFragment,
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
    expr: AggregateFragment,
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
      func = 'COUNT(DISTINCT';
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
      return `${func} CASE WHEN ${state.whereSQL} THEN ${thing} END)`;
    } else {
      return `${func} ${thing})`;
    }
  }

  generateDialect(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: DialectFragment,
    state: GenerateState
  ): string {
    return this.generateExpressionFromExpr(
      resultSet,
      context,
      context.dialect.dialectExpr(resultSet.getQueryInfo(), expr),
      state
    );
  }

  generateSqlString(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: SqlStringFragment,
    state: GenerateState
  ): string {
    return expr.e
      .map(part =>
        typeof part === 'string'
          ? part
          : this.generateExpressionFromExpr(resultSet, context, [part], state)
      )
      .join('');
  }

  generateSourceReference(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    expr: SourceReferenceFragment
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
        fi => isScalarField(fi.f) && fi.fieldUsage.type === 'result'
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
    if (!funcOrdering && overload.needsWindowOrderBy) {
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
        orderBy = ' ' + this.parent.dialect.sqlOrderBy(obSQL);
      }
    }

    let between = '';
    if (overload.between) {
      const [preceding, following] = [
        overload.between.preceding,
        overload.between.following,
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
        if (
          arg.length !== 1 ||
          typeof arg[0] === 'string' ||
          arg[0].type !== 'dialect' ||
          arg[0].function !== 'numberLiteral'
        ) {
          throw new Error('Invalid number of rows for window spec');
        }
        // TODO this does not handle float literals correctly
        return arg[0].literal;
      });
      between = `ROWS BETWEEN ${preceding} PRECEDING AND ${following} FOLLOWING`;
    }

    const funcSQL = this.generateExpressionFromExpr(
      resultStruct,
      context,
      expr,
      state
    );

    return `${funcSQL} OVER(${partitionBy} ${orderBy} ${between})`;
  }

  generateExpressionFromExpr(
    resultSet: FieldInstanceResult,
    context: QueryStruct,
    e: Expr,
    state: GenerateState = new GenerateState()
  ): string {
    let s = '';
    for (const expr of e) {
      if (typeof expr === 'string') {
        s += expr;
      } else if (isFieldFragment(expr)) {
        s += this.generateFieldFragment(resultSet, context, expr, state);
      } else if (isParameterFragment(expr)) {
        s += this.generateParameterFragment(resultSet, context, expr, state);
      } else if (isFilterFragment(expr)) {
        s += this.generateFilterFragment(resultSet, context, expr, state);
      } else if (isUngroupFragment(expr)) {
        s += this.generateUngroupedFragment(resultSet, context, expr, state);
      } else if (isAggregateFragment(expr)) {
        let agg;
        if (expr.function === 'sum') {
          agg = this.generateSumFragment(resultSet, context, expr, state);
        } else if (expr.function === 'avg') {
          agg = this.generateAvgFragment(resultSet, context, expr, state);
        } else if (expr.function === 'count') {
          agg = this.generateCountFragment(resultSet, context, expr, state);
        } else if (['count_distinct', 'min', 'max'].includes(expr.function)) {
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
          s += this.caseGroup([groupSet], agg);
        } else {
          s += agg;
        }
      } else if (isApplyFragment(expr)) {
        const applyVal = this.generateExpressionFromExpr(
          resultSet,
          context,
          expr.value,
          state
        );
        s += this.generateExpressionFromExpr(
          resultSet,
          context,
          expr.to,
          state.withApply(applyVal)
        );
      } else if (isApplyValue(expr)) {
        if (state.applyValue) {
          s += state.applyValue;
        } else {
          throw new Error(
            'Internal Error: Partial application value referenced but not provided'
          );
        }
      } else if (isFunctionParameterFragment(expr)) {
        throw new Error(
          'Internal Error: Function parameter fragment remaining during SQL generation'
        );
      } else if (isOutputFieldFragment(expr)) {
        s += this.generateOutputFieldFragment(resultSet, context, expr, state);
      } else if (isSQLExpressionFragment(expr)) {
        s += this.generateSQLExpression(resultSet, context, expr, state);
      } else if (isFunctionCallFragment(expr)) {
        s += this.generateFunctionCallExpression(
          resultSet,
          context,
          expr,
          state
        );
      } else if (isSpreadFragment(expr)) {
        s += this.generateSpread(resultSet, context, expr, state);
      } else if (expr.type === 'dialect') {
        s += this.generateDialect(resultSet, context, expr, state);
      } else if (expr.type === 'sql-string') {
        s += this.generateSqlString(resultSet, context, expr, state);
      } else if (expr.type === 'source-reference') {
        s += this.generateSourceReference(resultSet, context, expr);
      } else {
        throw new Error(
          `Internal Error: Unknown expression fragment ${JSON.stringify(
            expr,
            undefined,
            2
          )}`
        );
      }
    }
    return s;
  }

  getExpr(): Expr {
    if (hasExpression(this.fieldDef)) {
      return this.fieldDef.e;
    }
    return [
      this.parent.dialect.sqlFieldReference(
        this.parent.getSQLIdentifier(),
        this.fieldDef.name,
        this.fieldDef.type,
        this.parent.fieldDef.structSource.type === 'nested' ||
          this.parent.fieldDef.structSource.type === 'inline' ||
          (this.parent.fieldDef.structSource.type === 'sql' &&
            this.parent.fieldDef.structSource.method === 'nested'),
        this.parent.fieldDef.structRelationship.type === 'nested' &&
          this.parent.fieldDef.structRelationship.isArray
      ),
    ];
  }

  generateExpression(resultSet: FieldInstanceResult): string {
    return this.generateExpressionFromExpr(
      resultSet,
      this.parent,
      this.getExpr()
    );
  }
}

function isCalculatedField(f: QueryField): f is QueryAtomicField {
  return f instanceof QueryAtomicField && f.isCalculated();
}

function isAggregateField(f: QueryField): f is QueryAtomicField {
  return f instanceof QueryAtomicField && f.isAggregate();
}

function isScalarField(f: QueryField): f is QueryAtomicField {
  return f instanceof QueryAtomicField && !f.isCalculated() && !f.isAggregate();
}

class QueryAtomicField extends QueryField {
  includeInWildcard(): boolean {
    return true;
  }

  isCalculated(): boolean {
    return expressionIsCalculation(
      (this.fieldDef as FieldAtomicDef).expressionType
    );
  }

  isAggregate(): boolean {
    return expressionIsAggregate(
      (this.fieldDef as FieldAtomicDef).expressionType
    );
  }

  getFilterList(): FilterExpression[] {
    return [];
  }

  hasExpression(): boolean {
    return hasExpression(this.fieldDef);
  }
}

// class QueryMeasure extends QueryField {}

class QueryFieldString extends QueryAtomicField {}
class QueryFieldNumber extends QueryAtomicField {}
class QueryFieldBoolean extends QueryAtomicField {}
class QueryFieldJSON extends QueryAtomicField {}
class QueryFieldUnsupported extends QueryAtomicField {}

// in a query a struct can be referenced.  The struct will
//  emit the primary key field in the actual result set and
//  will include the StructDef as a foreign key join in the output
//  StructDef.
class QueryFieldStruct extends QueryAtomicField {
  primaryKey: string;

  constructor(fieldDef: FieldDef, parent: QueryStruct, primaryKey: string) {
    super(fieldDef, parent);
    this.primaryKey = primaryKey;
  }

  getName() {
    return getIdentifier(this.fieldDef);
  }

  getAsJoinedStructDef(foreignKeyName: string): StructDef {
    return {
      ...this.parent.fieldDef,
      structRelationship: {
        type: 'one',
        matrixOperation: 'left',
        onExpression: [
          {
            type: 'field',
            path: [this.primaryKey],
          },
          '=',
          {type: 'field', path: [foreignKeyName]},
        ],
      },
    };
  }
}

class QueryFieldDate extends QueryAtomicField {
  generateExpression(resultSet: FieldInstanceResult): string {
    const fd = this.fieldDef as FieldDateDef;
    if (!fd.timeframe) {
      return super.generateExpression(resultSet);
    } else {
      const truncated = this.parent.dialect.sqlTrunc(
        resultSet.getQueryInfo(),
        {value: this.getExpr(), valueType: 'date'},
        fd.timeframe
      );
      return this.generateExpressionFromExpr(resultSet, this.parent, truncated);
    }
  }

  // clone ourselves on demand as a timeframe.
  getChildByName(name: string): QueryFieldDate {
    const fieldDef = {
      ...this.fieldDef,
      as: `${this.getIdentifier()}_${name}`,
      timeframe: name,
    };
    return new QueryFieldDate(fieldDef as FieldDateDef, this.parent);
  }
}

class QueryFieldTimestamp extends QueryAtomicField {
  // clone ourselves on demand as a timeframe.
  getChildByName(name: string): QueryFieldTimestamp {
    const fieldDef = {
      ...this.fieldDef,
      as: `${this.getIdentifier()}_${name}`,
      timeframe: name,
    };
    return new QueryFieldTimestamp(fieldDef as FieldTimestampDef, this.parent);
  }
}

class QueryFieldDistinctKey extends QueryAtomicField {
  generateExpression(resultSet: FieldInstanceResult): string {
    if (this.parent.primaryKey()) {
      const pk = this.parent.getPrimaryKeyField(this.fieldDef);
      return pk.generateExpression(resultSet);
    } else if (this.parent.fieldDef.structSource.type === 'nested') {
      const parentKey = this.parent.parent
        ?.getDistinctKey()
        .generateExpression(resultSet);
      return this.parent.dialect.concat(
        parentKey || '', // shouldn't have to do this...
        "'x'",
        this.parent.dialect.sqlFieldReference(
          this.parent.getIdentifier(),
          '__row_id',
          'string',
          true,
          false
        )
      );
    } else {
      // return this.parent.getIdentifier() + "." + "__distinct_key";
      return this.parent.dialect.sqlFieldReference(
        this.parent.getIdentifier(),
        '__distinct_key',
        'string',
        this.parent.fieldDef.structRelationship.type === 'nested',
        false
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
  ret = `CAST(${ret} as ${dialect.defaultNumberType})`;
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
        if (isScalarField(f.f)) {
          return 'nested';
        }
        if (f.f instanceof QueryStruct) {
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
          firstField ||= fi.fieldUsage.resultIndex;
          if (['date', 'timestamp'].indexOf(fi.f.fieldDef.type) > -1) {
            return [{dir: 'desc', field: fi.fieldUsage.resultIndex}];
          } else if (isAggregateField(fi.f)) {
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
    const sr = qs.fieldDef.structRelationship;
    if (
      isJoinOn(sr) &&
      qs.parent && // if the join has an ON, it must thave a parent
      sr.onExpression !== undefined &&
      joinStack.indexOf(name) === -1
    ) {
      query.addDependantExpr(this, qs.parent, sr.onExpression, [
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
      this.addStructToJoin(
        dim.f.getJoinableParent(),
        query,
        dim.f.uniqueKeyPossibleUse(),
        []
      );
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
          isScalarField(fi.f) &&
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
      if (join.leafiest) {
        if (
          join.parent !== null &&
          join.uniqueKeyPossibleUses.has('count') &&
          !join.queryStruct.primaryKey()
        ) {
          join.makeUniqueKey = true;
        }
      } else if (
        !join.leafiest &&
        join.uniqueKeyPossibleUses.hasAsymetricFunctions()
      ) {
        let j: JoinInstance | undefined = join;
        while (j) {
          if (!j.queryStruct.primaryKey()) {
            j.makeUniqueKey = true;
          }
          if (j.queryStruct.fieldDef.structRelationship.type === 'nested') {
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
    if (this.queryStruct.fieldDef.filterList) {
      this.joinFilterConditions = [];
      for (const filter of this.queryStruct.fieldDef.filterList) {
        const qf = new QueryFieldBoolean(
          {
            type: 'boolean',
            name: 'ignoreme',
            e: filter.expression,
          },
          this.queryStruct
        );
        this.joinFilterConditions.push(qf);
      }
    }
  }

  parentRelationship(): 'root' | JoinRelationship {
    if (this.queryStruct.parent === undefined) {
      return 'root';
    }
    switch (this.queryStruct.fieldDef.structRelationship.type) {
      case 'one':
        return 'many_to_one';
      case 'cross':
        return 'many_to_many';
      case 'many':
        return 'one_to_many';
      case 'nested':
        return 'one_to_many';
      case 'inline':
        return 'one_to_one';
      default:
        throw new Error(
          `Internal error unknown relationship type to parent for ${this.queryStruct.fieldDef.name}`
        );
    }
  }

  // For now, we force all symmetric calculations for full and right joins
  //  because we need distinct keys for COUNT(xx) operations.  Don't really need
  //  this for sums.  This will produce correct results and we can optimize this
  //  at some point..
  forceAllSymmetricCalculations(): boolean {
    const sr = this.queryStruct.fieldDef.structRelationship;
    if (this.queryStruct.parent === undefined || !isJoinOn(sr)) {
      return false;
    }
    if (sr.matrixOperation === 'right' || sr.matrixOperation === 'full') {
      return true;
    }
    return false;
  }

  // postgres unnest needs to know the names of the physical fields.
  getDialectFieldList(): DialectFieldList {
    const dialectFieldList: DialectFieldList = [];

    for (const f of this.queryStruct.fieldDef.fields.filter(isPhysical)) {
      dialectFieldList.push({
        type: f.type,
        sqlExpression: getIdentifier(f),
        sqlOutputName: getIdentifier(f),
      });
    }
    return dialectFieldList;
  }
}

/** nested query */
class QueryTurtle extends QueryField {}

/**
 * Used by the translator to get the output StructDef of a pipe segment
 *
 * half translated to the new world of types ..
 */
export class Segment {
  static nextStructDef(structDef: StructDef, segment: PipeSegment): StructDef {
    const qs = new QueryStruct(structDef, {
      model: new QueryModel(undefined),
    });
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
    const sourceDef = parentStruct.fieldDef;

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
        parent.parent ? {struct: parent} : {model: parent.model}
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
    return (
      this.parent.fieldDef.structSource.type === 'sql' &&
      this.parent.fieldDef.structSource.method === 'nested'
    );
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
    const node = context.getFieldByName(path);
    let struct;
    if (node instanceof QueryField) {
      struct = node.parent;
    } else if (node instanceof QueryStruct) {
      struct = node;
    } else {
      throw new Error('Internal Error:  Unknown object type');
    }
    resultStruct
      .root()
      .addStructToJoin(
        struct.getJoinableParent(),
        this,
        uniqueKeyPossibleUse,
        joinStack
      );
  }

  addDependantExpr(
    resultStruct: FieldInstanceResult,
    context: QueryStruct,
    e: Expr,
    joinStack: string[]
  ): void {
    for (const expr of e) {
      if (
        isFunctionCallFragment(expr) &&
        expressionIsAnalytic(expr.overload.returnType.expressionType) &&
        this.parent.dialect.cantPartitionWindowFunctionsOnExpressions
      ) {
        // force the use of a lateral_join_bag
        resultStruct.root().isComplexQuery = true;
        resultStruct.root().queryUsesPartitioning = true;
      }
      if (isUngroupFragment(expr)) {
        resultStruct.resultUsesUngrouped = true;
        resultStruct.root().isComplexQuery = true;
        resultStruct.root().queryUsesPartitioning = true;
        if (expr.fields && expr.fields.length > 0) {
          const key = expr.fields.sort().join('|') + expr.type;
          if (resultStruct.ungroupedSets.get(key) === undefined) {
            resultStruct.ungroupedSets.set(key, {
              type: expr.type,
              fields: expr.fields,
              groupSet: -1,
            });
          }
        }

        this.addDependantExpr(resultStruct, context, expr.e, joinStack);
      } else if (isFieldFragment(expr)) {
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
          // this.addDependantPath(resultStruct, field.parent, expr.path, false);
        }
      } else if (isFilterFragment(expr)) {
        for (const filterCond of expr.filterList) {
          this.addDependantExpr(
            resultStruct,
            context,
            filterCond.expression,
            joinStack
          );
          this.addDependantExpr(resultStruct, context, expr.e, joinStack);
        }
        this.addDependantExpr(resultStruct, context, expr.e, joinStack);
      } else if (isDialectFragment(expr)) {
        const expressions: Expr[] = [];
        switch (expr.function) {
          case 'now':
            break;
          case 'div':
            expressions.push(expr.denominator);
            expressions.push(expr.numerator);
            break;
          case 'numberLiteral':
          case 'timeLiteral':
          case 'stringLiteral':
          case 'regexpLiteral':
            break;
          case 'timeDiff':
            expressions.push(expr.left.value, expr.right.value);
            break;
          case 'delta':
            expressions.push(expr.base.value, expr.delta);
            break;
          case 'trunc':
          case 'extract':
            expressions.push(expr.expr.value);
            break;
          case 'regexpMatch':
          case 'cast':
            expressions.push(expr.expr);
            break;
          default:
            throw new Error(
              "Unknown dialect Fragment type.  Can't generate dependancies"
            );
        }
        for (const e of expressions) {
          this.addDependantExpr(resultStruct, context, e, joinStack);
        }
      } else if (isAggregateFragment(expr)) {
        if (isAsymmetricFragment(expr)) {
          if (expr.structPath) {
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
        this.addDependantExpr(resultStruct, context, expr.e, joinStack);
      } else if (isFunctionCallFragment(expr)) {
        if (expr.structPath) {
          this.addDependantPath(
            resultStruct,
            context,
            expr.structPath,
            'generic_aggregate',
            joinStack
          );
        }
        // TODO Do we need to call `addStructToJoin` here in the case when there is no `structPath`
        // and the function is an aggregate function?
        for (const e of expr.args) {
          this.addDependantExpr(resultStruct, context, e, joinStack);
        }
        if (expressionIsAnalytic(expr.overload.returnType.expressionType)) {
          resultStruct.root().queryUsesPartitioning = true;
        }
        if (expr.orderBy) {
          for (const ob of expr.orderBy) {
            this.addDependantExpr(resultStruct, context, ob.e, joinStack);
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

      if (field instanceof QueryTurtle || field instanceof QueryQuery) {
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

        if (isAggregateField(field)) {
          if (this.firstSegment.type === 'project') {
            throw new Error(
              `Aggregate Fields cannot be used in select - '${field.fieldDef.name}'`
            );
          }
        }
        // } else if (field instanceof QueryStruct) {
        //   // this could probably be optimized.  We are adding the primary key of the joined structure
        //   //  instead of the foreignKey.  We have to do this in at least the INNER join case
        //   //  so i'm just going to let the SQL database do the optimization (which is pretty rudimentary)
        //   const pkFieldDef = field.getAsQueryField();
        //   resultStruct.addField(as, pkFieldDef, {
        //     resultIndex,
        //     type: "result",
        //   });
        //   resultStruct.addStructToJoin(field, false);
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
      this.addDependantExpr(resultStruct, context, cond.expression, []);
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
    which: 'where' | 'having',
    filterList: FilterExpression[] | undefined = undefined
  ): AndChain {
    const resultFilters = new AndChain();
    const list = filterList || resultStruct.firstSegment.filterList;
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
        const sqlClause = this.generateExpressionFromExpr(
          resultStruct,
          context,
          cond.expression,
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
      this.rootResult.calculateSymmetricAggregates();
      this.prepared = true;
    }
  }

  // get the source fieldname and filters associated with the field (so we can drill later)
  getResultMetadata(
    fi: FieldInstance
  ): ResultStructMetadataDef | ResultMetadataDef | undefined {
    if (fi instanceof FieldInstanceField) {
      if (fi.fieldUsage.type === 'result') {
        const fieldDef = fi.f.fieldDef as FieldAtomicDef;
        let filterList;
        const sourceField =
          fi.f.parent.getFullOutputName() +
          (fieldDef.name || fieldDef.as || 'undefined');
        const sourceExpression: string | undefined = fieldDef.code;
        const sourceClasses = [sourceField];
        if (isCalculatedField(fi.f)) {
          filterList = fi.f.getFilterList();
          return {
            sourceField,
            sourceExpression,
            filterList,
            sourceClasses,
            fieldKind: 'measure',
          };
        }
        if (isScalarField(fi.f)) {
          return {
            sourceField,
            sourceExpression,
            filterList,
            sourceClasses,
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
  ): StructDef {
    const fields: FieldDef[] = [];
    let primaryKey;
    this.prepare(undefined);

    let dimCount = 0;
    for (const [name, fi] of resultStruct.allFields) {
      const resultMetadata = this.getResultMetadata(fi);
      if (fi instanceof FieldInstanceResult) {
        const {structDef} = this.generateTurtlePipelineSQL(
          fi,
          new StageWriter(true, undefined),
          '<nosource>'
        );

        // LTNOTE: This is probably broken now.  Need to look at the last stage
        //  to figure out the resulting nested/inline state...

        const resultType =
          fi.getRepeatedResultType() === 'nested' ? 'nested' : 'inline';
        structDef.name = name;
        structDef.structRelationship = {
          fieldName: name,
          type: resultType,
          isArray: false,
        };
        structDef.structSource = {type: resultType};
        structDef.resultMetadata = resultMetadata;
        fields.push(structDef);
      } else if (fi instanceof FieldInstanceField) {
        if (fi.fieldUsage.type === 'result') {
          if (fi.f instanceof QueryFieldStruct) {
            fields.push(fi.f.getAsJoinedStructDef(name));
          }
          // if there is only one dimension, it is the primaryKey
          //  if there are more, primaryKey is undefined.
          if (isScalarField(fi.f)) {
            if (dimCount === 0 && isRoot) {
              primaryKey = name;
            } else {
              primaryKey = undefined;
            }
            dimCount++;
          }

          const location = fi.f.fieldDef.location;
          const annotation = fi.f.fieldDef.annotation;

          // build out the result fields...
          switch (fi.f.fieldDef.type) {
            case 'boolean':
            case 'json':
            case 'string':
              fields.push({
                name,
                type: fi.f.fieldDef.type,
                resultMetadata,
                location,
                annotation,
              });
              break;
            case 'timestamp': {
              const timeframe = fi.f.fieldDef.timeframe;
              if (timeframe) {
                fields.push({
                  name,
                  type: 'timestamp',
                  timeframe,
                  resultMetadata,
                  location,
                  annotation,
                });
              } else {
                fields.push({
                  name,
                  type: 'timestamp',
                  resultMetadata,
                  location,
                  annotation,
                });
              }
              break;
            }
            case 'date': {
              fields.push({
                name,
                type: fi.f.fieldDef.type,
                timeframe: fi.f.fieldDef.timeframe,
                resultMetadata,
                location,
                annotation,
              });
              break;
            }
            case 'number':
              fields.push({
                name,
                numberType: fi.f.fieldDef.numberType,
                type: 'number',
                resultMetadata,
                location,
                annotation,
              });
              break;
            case 'unsupported':
              fields.push({...fi.f.fieldDef, resultMetadata, location});
              break;
            default:
              throw new Error(
                `unknown Field Type in query ${JSON.stringify(fi.f.fieldDef)}`
              );
          }
        }
      }
    }
    const outputStruct: StructDef = {
      fields,
      name: this.resultStage || 'result',
      dialect: this.parent.dialect.name,
      primaryKey,
      structRelationship: {
        type: 'basetable',
        connectionName: this.parent.connectionName,
      },
      structSource: {type: 'query_result'},
      resultMetadata: this.getResultMetadata(this.rootResult),
      type: 'struct',
      queryTimezone: resultStruct.getQueryInfo().queryTimezone,
    };
    if (this.parent.fieldDef.modelAnnotation) {
      outputStruct.modelAnnotation = this.parent.fieldDef.modelAnnotation;
    }

    return outputStruct;
  }

  generateSQLJoinBlock(stageWriter: StageWriter, ji: JoinInstance): string {
    let s = '';
    const qs = ji.queryStruct;
    const structRelationship = qs.fieldDef.structRelationship;
    let structSQL = qs.structSourceSQL(stageWriter);
    if (isJoinOn(structRelationship)) {
      const matrixOperation = structRelationship.matrixOperation.toUpperCase();
      if (ji.makeUniqueKey) {
        const passKeys = this.generateSQLPassthroughKeys(qs);
        structSQL = `(SELECT ${qs.dialect.sqlGenerateUUID()} as __distinct_key, x.* ${passKeys} FROM ${structSQL} as x)`;
      }
      let onCondition = '';
      if (qs.parent === undefined) {
        throw new Error('Expected joined struct to have a parent.');
      }
      if (structRelationship.onExpression) {
        onCondition = new QueryFieldBoolean(
          {
            type: 'boolean',
            name: 'ignoreme',
            e: structRelationship.onExpression,
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
      if (ji.children.length === 0 || conditions === undefined) {
        if (conditions !== undefined && conditions.length >= 1) {
          filters = ` AND (${conditions.join(' AND ')})`;
        }
        s += ` ${matrixOperation} JOIN ${structSQL} AS ${ji.alias}\n  ON ${onCondition}${filters}\n`;
      } else {
        let select = `SELECT ${ji.alias}.*`;
        let joins = '';
        for (const childJoin of ji.children) {
          joins += this.generateSQLJoinBlock(stageWriter, childJoin);
          const physicalFields = getPhysicalFields(
            childJoin.queryStruct.fieldDef
          ).map(fieldDef =>
            this.parent.dialect.sqlMaybeQuoteIdentifier(fieldDef.name)
          );
          select += `, ${this.parent.dialect.sqlSelectAliasAsStruct(
            childJoin.alias,
            physicalFields
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
    } else if (structRelationship.type === 'nested') {
      if (qs.parent === undefined || ji.parent === undefined) {
        throw new Error('Internal Error, nested structure with no parent.');
      }
      const fieldExpression = this.parent.dialect.sqlFieldReference(
        qs.parent.getSQLIdentifier(),
        structRelationship.fieldName as string,
        'struct',
        qs.parent.fieldDef.structRelationship.type === 'nested',
        this.parent.fieldDef.structRelationship.type === 'nested' &&
          this.parent.fieldDef.structRelationship.isArray
      );
      // we need to generate primary key.  If parent has a primary key combine
      // console.log(ji.alias, fieldExpression, this.inNestedPipeline());
      s += `${this.parent.dialect.sqlUnnestAlias(
        fieldExpression,
        ji.alias,
        ji.getDialectFieldList(),
        ji.makeUniqueKey,
        structRelationship.isArray,
        this.inNestedPipeline()
      )}\n`;
    } else if (structRelationship.type === 'inline') {
      throw new Error(
        'Internal Error: inline structs should never appear in join trees'
      );
    } else {
      throw new Error(
        `Join type not implemented ${JSON.stringify(
          qs.fieldDef.structRelationship
        )}`
      );
    }
    for (const childJoin of ji.children) {
      s += this.generateSQLJoinBlock(stageWriter, childJoin);
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
        structSQL = stageWriter.addStage(
          `SELECT * from ${structSQL} as x limit 100000 `
        );
      }
    }
    const structRelationship = qs.fieldDef.structRelationship;
    if (structRelationship.type === 'basetable') {
      if (ji.makeUniqueKey) {
        const passKeys = this.generateSQLPassthroughKeys(qs);
        structSQL = `(SELECT ${qs.dialect.sqlGenerateUUID()} as __distinct_key, x.* ${passKeys} FROM ${structSQL} as x)`;
      }
      s += `FROM ${structSQL} as ${ji.alias}\n`;
    } else {
      throw new Error('Internal Error, queries must start from a basetable');
    }

    for (const childJoin of ji.children) {
      s += this.generateSQLJoinBlock(stageWriter, childJoin);
    }
    return s;
  }

  genereateSQLOrderBy(
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
          o.push(`${fi.fieldUsage.resultIndex} ${f.dir || 'ASC'}`);
        } else {
          throw new Error(`Unknown field in ORDER BY ${f.field}`);
        }
      } else {
        o.push(`${f.field} ${f.dir || 'ASC'}`);
      }
    }
    if (o.length > 0) {
      s = this.parent.dialect.sqlOrderBy(o) + '\n';
    }
    return s;
  }

  generateSimpleSQL(stageWriter: StageWriter): string {
    let s = '';
    s += 'SELECT \n';
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
          n.push(fi.fieldUsage.resultIndex.toString());
        }
      }
      if (n.length > 0) {
        s += `GROUP BY ${n.join(',')}\n`;
      }
    }

    s += this.generateSQLFilters(this.rootResult, 'having').sql('having');

    // order by
    s += this.genereateSQLOrderBy(
      this.firstSegment as QuerySegment,
      this.rootResult
    );

    // limit
    if (!isRawSegment(this.firstSegment) && this.firstSegment.limit) {
      s += `LIMIT ${this.firstSegment.limit}\n`;
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
    const pipelinesSQL = outputPipelinedSQL
      .map(
        o =>
          `${o.pipelineSQL} as ${o.sqlFieldName}
      `
      )
      .join(',\n');
    return stageWriter.addStage(
      `SELECT * replace (${pipelinesSQL}) FROM ${lastStageName}
      `
    );
  }

  generateStage0Fields(
    resultSet: FieldInstanceResult,
    output: StageOutputContext,
    stageWriter: StageWriter
  ) {
    for (const [name, fi] of resultSet.allFields) {
      const outputName = this.parent.dialect.sqlMaybeQuoteIdentifier(
        `${name}__${resultSet.groupSet}`
      );
      if (fi instanceof FieldInstanceField) {
        if (fi.fieldUsage.type === 'result') {
          const exp = fi.getSQL();
          if (isScalarField(fi.f)) {
            if (
              this.parent.dialect.cantPartitionWindowFunctionsOnExpressions &&
              this.rootResult.queryUsesPartitioning
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
          } else if (isCalculatedField(fi.f)) {
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
        fields.push(
          `MAX(CASE WHEN group_set IN (${result.childGroups.join(
            ','
          )}) THEN __delete__${
            result.groupSet
          } END) OVER(partition by ${dimensions
            .map(this.parent.dialect.castToString)
            .join(',')}) as __shaving__${result.groupSet}`
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

    if (this.firstSegment.type === 'project') {
      throw new Error('PROJECT cannot be used on queries with turtles');
    }
    const groupBy = 'GROUP BY ' + f.dimensionIndexes.join(',') + '\n';

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
          } else if (isCalculatedField(fi.f)) {
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
      output.sql[0] += ' ELSE group_set END as group_set';
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
    if (f.dimensionIndexes.length > 0) {
      s += `GROUP BY ${f.dimensionIndexes.join(',')}\n`;
    }

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
    let s = 'SELECT\n';
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
          } else if (isCalculatedField(fi.f)) {
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

    if (dimensionIndexes.length > 0) {
      s += `GROUP BY ${dimensionIndexes.join(',')}\n`;
    }

    // order by
    s += this.genereateSQLOrderBy(
      this.firstSegment as QuerySegment,
      this.rootResult
    );

    // limit
    if (!isRawSegment(this.firstSegment) && this.firstSegment.limit) {
      s += `LIMIT ${this.firstSegment.limit}\n`;
    }

    this.resultStage = stageWriter.addStage(s);
    this.resultStage = this.generatePipelinedStages(
      outputPipelinedSQL,
      this.resultStage,
      stageWriter
    );

    return this.resultStage;
  }

  generateTurtleSQL(
    resultStruct: FieldInstanceResult,
    stageWriter: StageWriter,
    sqlFieldName: string,
    outputPipelinedSQL: OutputPipelinedSQL[]
  ): string {
    // let fieldsSQL: string[] = [];
    const dialectFieldList: DialectFieldList = [];
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
      orderBy = ' ' + this.parent.dialect.sqlOrderBy(obSQL);
    }

    for (const [name, field] of resultStruct.allFields) {
      const sqlName = this.parent.dialect.sqlMaybeQuoteIdentifier(name);
      //
      if (
        resultStruct.firstSegment.type === 'reduce' &&
        (field instanceof FieldInstanceResult ||
          (field instanceof FieldInstanceField &&
            field.fieldUsage.type === 'result'))
      ) {
        // fieldsSQL.push(`${name}__${resultStruct.groupSet} as ${sqlName}`);
        // outputFieldNames.push(name);
        dialectFieldList.push({
          type:
            field instanceof FieldInstanceField
              ? field.f.fieldDef.type
              : 'struct',
          sqlExpression: this.parent.dialect.sqlMaybeQuoteIdentifier(
            `${name}__${resultStruct.groupSet}`
          ),
          sqlOutputName: sqlName,
        });
      } else if (
        resultStruct.firstSegment.type === 'project' &&
        field instanceof FieldInstanceField &&
        field.fieldUsage.type === 'result'
      ) {
        // fieldsSQL.push(
        //   `${field.f.generateExpression(resultStruct)} as ${sqlName}`
        // );
        dialectFieldList.push({
          type: field.type,
          sqlExpression: field.f.generateExpression(resultStruct),
          sqlOutputName: sqlName,
        });
      }
    }

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
    if (hasPipeline) {
      const pipeline: PipeSegment[] = [...fi.turtleDef.pipeline];
      pipeline.shift();
      const newTurtle: TurtleDef = {
        type: 'turtle',
        name: 'starthere',
        pipeline,
      };
      structDef.name = this.parent.dialect.sqlUnnestPipelineHead(
        repeatedResultType === 'inline_all_numbers',
        sourceSQLExpression
      );
      structDef.structSource = {type: 'sql', method: 'nested'};
      const qs = new QueryStruct(structDef, {
        model: this.parent.getModel(),
      });
      const q = QueryQuery.makeQuery(
        newTurtle,
        qs,
        stageWriter,
        this.isJoinedSubquery
      );
      pipeOut = q.generateSQLFromPipeline(stageWriter);
      // console.log(stageWriter.generateSQLStages());
      structDef = pipeOut.outputStruct;
    }
    structDef.annotation = fi.turtleDef.annotation;
    return {
      structDef,
      pipeOut,
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

  toMalloy(): string {
    let ret = `EXPLORE ${getIdentifier(this.parent.fieldDef)} | `;
    ret += this.fieldDef.type.toUpperCase() + ' ';
    return ret;
  }

  generateSQLFromPipeline(stageWriter: StageWriter) {
    this.prepare(stageWriter);
    let lastStageName = this.generateSQL(stageWriter);
    let outputStruct = this.getResultStructDef();
    if (this.fieldDef.pipeline.length > 1) {
      // console.log(pretty(outputStruct));
      const pipeline = [...this.fieldDef.pipeline];
      let structDef: StructDef = {
        ...outputStruct,
        structSource: {type: 'sql', method: 'lastStage'},
      };
      pipeline.shift();
      for (const transform of pipeline) {
        const s = new QueryStruct(structDef, {
          model: this.parent.getModel(),
        });
        const q = QueryQuery.makeQuery(
          {type: 'turtle', name: 'ignoreme', pipeline: [transform]},
          s,
          stageWriter,
          this.isJoinedSubquery
        );
        q.prepare(stageWriter);
        lastStageName = q.generateSQL(stageWriter);
        outputStruct = q.getResultStructDef();
        structDef = {
          ...outputStruct,
          structSource: {type: 'sql', method: 'lastStage'},
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

    let s = 'SELECT\n  group_set,\n';

    s += '  CASE group_set\n';
    for (let i = 0; i < fields.length; i++) {
      s += `    WHEN ${i} THEN '${fields[i].name}'\n`;
    }
    s += `  END as ${fieldNameColumn},\n`;

    s += '  CASE group_set\n';
    for (let i = 0; i < fields.length; i++) {
      const path = pathToCol(fields[i].path);
      s += `    WHEN ${i} THEN '${path}'\n`;
    }
    s += `  END as ${fieldPathColumn},\n`;

    s += '  CASE group_set\n';
    for (let i = 0; i < fields.length; i++) {
      s += `    WHEN ${i} THEN '${fields[i].type}'\n`;
    }
    s += `  END as ${fieldTypeColumn},`;

    s += `  CASE group_set WHEN 99999 THEN ${dialect.castToString('NULL')}\n`;
    for (let i = 0; i < fields.length; i++) {
      if (fields[i].type === 'string') {
        s += `    WHEN ${i} THEN ${fields[i].expression}\n`;
      }
    }
    s += `  END as ${fieldValueColumn},\n`;

    s += ` ${measureSQL} as weight,\n`;

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

    s += 'GROUP BY 1,2,3,4,5\n';

    // limit
    if (!isRawSegment(this.firstSegment) && this.firstSegment.limit) {
      s += `LIMIT ${this.firstSegment.limit}\n`;
    }
    // console.log(s);
    const resultStage = stageWriter.addStage(s);
    this.resultStage = stageWriter.addStage(
      `SELECT
  ${fieldNameColumn},
  ${fieldPathColumn},
  ${fieldTypeColumn},
  COALESCE(${fieldValueColumn}, ${fieldRangeColumn}) as ${fieldValueColumn},
  weight
FROM ${resultStage}\n`
    );
    return this.resultStage;
  }
}

class QueryQueryRaw extends QueryQuery {
  generateSQL(stageWriter: StageWriter): string {
    const ssrc = this.parent.fieldDef.structSource;
    if (ssrc.type !== 'sql' || ssrc.method !== 'subquery') {
      throw new Error(
        'Invalid struct for QueryQueryRaw, currently only supports SQL'
      );
    }
    const s = ssrc.sqlBlock.selectStr;
    return stageWriter.addStage(s);
  }

  prepare() {
    // Do nothing!
  }

  getResultStructDef(): StructDef {
    return this.parent.fieldDef;
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
            f instanceof QueryStruct &&
            (f.fieldDef.structRelationship.type === 'many' ||
              f.fieldDef.structRelationship.type === 'nested') &&
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
  getResultStructDef(): StructDef {
    const ret: StructDef = {
      type: 'struct',
      name: this.resultStage || 'result',
      dialect: this.parent.fieldDef.dialect,
      fields: [
        {type: 'string', name: 'fieldName'},
        {type: 'string', name: 'fieldPath'},
        {type: 'string', name: 'fieldValue'},
        {type: 'string', name: 'fieldType'},
        {type: 'number', name: 'weight', numberType: 'integer'},
      ],
      structRelationship: {
        type: 'basetable',
        connectionName: this.parent.connectionName,
      },
      structSource: {type: 'query_result'},
    };
    if (this.parent.fieldDef.modelAnnotation) {
      ret.modelAnnotation = this.parent.fieldDef.modelAnnotation;
    }
    return ret;
  }
}

/** Structure object as it is used to build a query */
class QueryStruct extends QueryNode {
  fieldDef: StructDef;
  parent: QueryStruct | undefined;
  model: QueryModel;
  nameMap = new Map<string, QuerySomething>();
  pathAliasMap: Map<string, string>;
  dialect: Dialect;
  connectionName: string;

  constructor(
    fieldDef: StructDef,
    parent: ParentQueryStruct | ParentQueryModel
  ) {
    super(fieldDef);
    this.setParent(parent);

    if ('model' in parent) {
      this.model = parent.model;
      this.pathAliasMap = new Map<string, string>();
      if (fieldDef.structRelationship.type === 'basetable') {
        this.connectionName = fieldDef.structRelationship.connectionName;
      } else {
        throw new Error('All root StructDefs should be a baseTable');
      }
    } else {
      this.model = this.getModel();
      this.pathAliasMap = this.root().pathAliasMap;
      this.connectionName = this.root().connectionName;
    }

    this.fieldDef = fieldDef; // shouldn't have to do this, but
    // type script is missing a beat here.

    this.dialect = getDialect(this.fieldDef.dialect);

    this.addFieldsFromFieldList(this.fieldDef.fields);
  }

  parameters(): Record<string, Parameter> {
    return this.fieldDef.parameters || {};
  }

  addFieldsFromFieldList(fields: FieldDef[]) {
    for (const field of fields) {
      const as = getIdentifier(field);

      switch (field.type) {
        case 'struct': {
          this.addFieldToNameMap(
            as,
            new QueryStruct(field as StructDef, {
              struct: this,
            })
          );
          break;
        }
        // case "reduce" || "project" || "index": {
        case 'turtle': {
          // not sure why we need to cast here...
          this.addFieldToNameMap(
            as,
            QueryQuery.makeQuery(field, this, undefined, false)
          );
          break;
        }
        default: {
          this.addFieldToNameMap(as, this.makeQueryField(field));
        }
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
      const base = identifierNormalize(getIdentifier(this.fieldDef));
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
        getIdentifier(this.fieldDef) +
        `[${this.getIdentifier()}.__row_id]`;
      return x;
    } else {
      return this.getIdentifier();
    }
  }

  // return the name of the field in SQL
  getIdentifier(): string {
    // if it is the root table, use provided alias if we have one.
    if (this.fieldDef.structRelationship.type === 'basetable') {
      if (this.fieldDef.as === undefined) {
        return 'base';
      } else {
        return identifierNormalize(super.getIdentifier());
      }
    }
    // if this is an inline object, include the parents alias.
    if (this.fieldDef.structRelationship.type === 'inline' && this.parent) {
      return this.parent.getSQLIdentifier() + '.' + super.getIdentifier();
    }
    // we are somewhere in the join tree.  Make sure the alias is unique.
    return this.getAliasIdentifier();
  }

  // return the name of the field in Malloy
  getFullOutputName(): string {
    if (this.parent) {
      return (
        this.parent.getFullOutputName() + getIdentifier(this.fieldDef) + '.'
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
    return (
      this.dialect.unnestWithNumbers &&
      this.fieldDef.structRelationship.type === 'nested'
    );
  }

  getJoinableParent(): QueryStruct {
    // if it is inline it should always have a parent
    if (this.fieldDef.structRelationship.type === 'inline') {
      if (this.parent) {
        return this.parent.getJoinableParent();
      } else {
        throw new Error('Internal Error: inline struct cannot be root');
      }
    }
    return this;
  }

  addFieldToNameMap(as: string, n: QuerySomething) {
    if (this.nameMap.has(as)) {
      throw new Error(`Redefinition of ${as}`);
    }
    this.nameMap.set(as, n);
  }

  /** the the primary key or throw an error. */
  getPrimaryKeyField(fieldDef: FieldDef): QueryAtomicField {
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
    if (this.fieldDef.structSource.type === 'query') {
      const structDef = this.model
        .loadQuery(this.fieldDef.structSource.query, undefined)
        .structs.pop();

      // should never happen.
      if (!structDef) {
        throw new Error("Internal Error, query didn't produce a struct");
      }

      const fieldDef = {...this.fieldDef};
      for (const f of structDef.fields) {
        let as;
        if (!this.nameMap.has((as = getIdentifier(f)))) {
          fieldDef.fields.push(f);
          this.nameMap.set(as, this.makeQueryField(f));
        }
      }
      this.fieldDef = fieldDef;
      if (!this.fieldDef.primaryKey && structDef.primaryKey) {
        this.fieldDef.primaryKey = structDef.primaryKey;
      }
    }
    for (const [, v] of this.nameMap) {
      if (v instanceof QueryStruct) {
        v.resolveQueryFields();
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
  makeQueryField(field: FieldDef): QueryField {
    switch (field.type) {
      case 'string':
        return new QueryFieldString(field, this);
      case 'date':
        return new QueryFieldDate(field, this);
      case 'timestamp':
        return new QueryFieldTimestamp(field, this);
      case 'number':
        return new QueryFieldNumber(field, this);
      case 'boolean':
        return new QueryFieldBoolean(field, this);
      case 'json':
        return new QueryFieldJSON(field, this);
      case 'unsupported':
        return new QueryFieldUnsupported(field, this);
      // case "reduce":
      // case "project":
      // case "index":
      case 'turtle':
        return new QueryTurtle(field, this);
      default:
        throw new Error(`unknown field definition ${JSON.stringify(field)}`);
    }
  }

  structSourceSQL(stageWriter: StageWriter): string {
    switch (this.fieldDef.structSource.type) {
      case 'table': {
        const tablePath = this.fieldDef.structSource.tablePath;
        return this.dialect.quoteTablePath(tablePath);
      }
      case 'sql':
        if (
          this.fieldDef.structSource.method === 'nested' ||
          this.fieldDef.structSource.method === 'lastStage'
        ) {
          return this.fieldDef.name;
        } else if (this.fieldDef.structSource.method === 'subquery') {
          return `(${this.fieldDef.structSource.sqlBlock.selectStr})`;
        }
        throw new Error(
          "Internal Error: Unknown structSource type 'sql' method"
        );
      case 'nested':
        // 'name' is always the source field even if has been renamed through
        // 'as'
        return 'UNNEST(this.fieldDef.name)';
      case 'inline':
        return '';
      case 'query': {
        // cache derived table.
        const name = getIdentifier(this.fieldDef);
        // this is a hack for now.  Need some way to denote this table
        //  should be cached.
        if (name.includes('cache')) {
          const dtStageWriter = new StageWriter(true, stageWriter);
          this.model.loadQuery(
            this.fieldDef.structSource.query,
            dtStageWriter,
            false,
            false
          );
          return dtStageWriter.addPDT(name, this.dialect);
        } else {
          // returns the stage name.
          return this.model.loadQuery(
            this.fieldDef.structSource.query,
            stageWriter,
            false,
            true // this is an intermediate stage.
          ).lastStageName;
        }
      }
      default:
        throw new Error(`unknown structSource ${this.fieldDef}`);
    }
  }

  root(): QueryStruct {
    if (this.parent === undefined) {
      return this;
    } else {
      return this.parent.root();
    }
  }

  primaryKey(): QueryAtomicField | undefined {
    if (this.fieldDef.primaryKey) {
      return this.getDimensionByName([this.fieldDef.primaryKey]);
    } else {
      return undefined;
    }
  }

  getChildByName(name: string): QuerySomething | undefined {
    return this.nameMap.get(name);
  }

  /** convert a path into a field reference */
  getFieldByName(path: string[]): QuerySomething {
    return path.reduce((lookIn: QuerySomething, childName: string) => {
      const r = lookIn.getChildByName(childName);
      if (r === undefined) {
        throw new Error(
          path.length === 1
            ? `'${childName}' not found`
            : `'${childName}' not found in '${path.join('.')}'`
        );
      }
      return r;
    }, this);
  }

  // structs referenced in queries are converted to fields.
  getQueryFieldByName(name: string[]): QuerySomething {
    const field = this.getFieldByName(name);
    if (field instanceof QueryStruct) {
      throw new Error(`Cannot reference ${name} as a scalar'`);
    }
    return field;
  }

  getQueryFieldReference(
    name: string[],
    refAnnoatation: Annotation | undefined
  ): QuerySomething {
    const field = this.getQueryFieldByName(name);
    if (refAnnoatation) {
      // Made the field object from the source, but the annotations were computed by the compiler
      // and have noth the source and reference annotations included, use those.
      const newDef = {...field.fieldDef};
      newDef.annotation = refAnnoatation;
      field.fieldDef = newDef;
    }
    return field;
  }

  getDimensionOrMeasureByName(name: string[]): QueryAtomicField {
    const query = this.getFieldByName(name);
    if (query instanceof QueryAtomicField) {
      return query;
    } else {
      throw new Error(`${name} is not of type a scalar'`);
    }
  }

  /** returns a query object for the given name */
  getDimensionByName(name: string[]): QueryAtomicField {
    const query = this.getFieldByName(name);

    if (query instanceof QueryAtomicField && isScalarField(query)) {
      return query;
    } else {
      throw new Error(`${name} is not of type a scalar'`);
    }
  }

  /** returns a query object for the given name */
  getStructByName(name: string[]): QueryStruct {
    const struct = this.getFieldByName(name);
    if (struct instanceof QueryStruct) {
      return struct;
    } else {
      throw new Error(`Error: Path to structure not found '${name.join('.')}'`);
    }
  }

  getDistinctKey(): QueryAtomicField {
    if (this.fieldDef.structRelationship.type !== 'inline') {
      return this.getDimensionByName(['__distinct_key']);
    } else if (this.parent) {
      return this.parent.getDistinctKey();
    } else {
      throw new Error('Internal Error.  inline struct can not be top level');
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
      this.fieldDef.filterList || []
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
  structs: StructDef[];
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
  constructor(modelDef: ModelDef | undefined) {
    if (modelDef) {
      this.loadModelFromDef(modelDef);
    }
  }

  loadModelFromDef(modelDef: ModelDef): void {
    this.modelDef = modelDef;
    for (const s of Object.values(this.modelDef.contents)) {
      let qs;
      if (s.type === 'struct') {
        qs = new QueryStruct(s, {model: this});
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
    let s;
    if ((s = this.structs.get(name))) {
      return s;
    } else {
      throw new Error(`Struct ${name} not found in model.`);
    }
  }

  getStructFromRef(structRef: StructRef): QueryStruct {
    let structDef;
    if (typeof structRef === 'string') {
      return this.getStructByName(structRef);
    } else if (structRef.type === 'struct') {
      structDef = structRef;
    } else {
      throw new Error('Broken for now');
    }
    return new QueryStruct(structDef, {model: this});
  }

  loadQuery(
    query: Query,
    stageWriter: StageWriter | undefined,
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

    const q = QueryQuery.makeQuery(
      turtleDef,
      this.getStructFromRef(query.structRef),
      stageWriter,
      isJoinedSubquery
    );

    const ret = q.generateSQLFromPipeline(stageWriter);
    if (emitFinalStage && q.parent.dialect.hasFinalStage) {
      // const fieldNames: string[] = [];
      // for (const f of ret.outputStruct.fields) {
      //   fieldNames.push(getIdentifier(f));
      // }
      const fieldNames = getPhysicalFields(ret.outputStruct).map(fieldDef =>
        q.parent.dialect.sqlMaybeQuoteIdentifier(fieldDef.name)
      );
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

  compileQuery(query: Query, finalize = true): CompiledQuery {
    let newModel: QueryModel | undefined;
    const m = newModel || this;
    const ret = m.loadQuery(query, undefined, finalize, false);
    const sourceExplore =
      typeof query.structRef === 'string'
        ? query.structRef
        : // LTNOTE: the parser needs to capture the query before the |.  This will work
        //  in most cases but isn't actually complete.
        query.structRef.type === 'struct'
        ? query.structRef.as || query.structRef.name
        : '(need to figure this out)';
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
      structs: ret.structs,
      sourceExplore,
      sourceFilters: query.filterList,
      queryName: query.name,
      connectionName: ret.connectionName,
      annotation: query.annotation,
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
      if (!(fv instanceof QueryStruct)) {
        if (isScalarField(fv) && fv.includeInWildcard()) {
          indexStar.push({type: 'fieldref', path: [fn]});
        }
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

    // if we've compiled the SQL before use it otherwise
    let sqlPDT = this.exploreSearchSQLMap.get(explore);
    if (sqlPDT === undefined) {
      sqlPDT = this.compileQuery(indexQuery, false).sql;
      this.exploreSearchSQLMap.set(explore, sqlPDT);
    }

    let query = `SELECT
              ${fieldNameColumn},
              ${fieldPathColumn},
              ${fieldValueColumn},
              ${fieldTypeColumn},
              weight,
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
            )}) THEN 1 ELSE 0 END DESC, weight DESC
            LIMIT ${limit}
          `;
    if (struct.dialect.hasFinalStage) {
      query = `WITH __stage0 AS(\n${query}\n)\n${struct.dialect.sqlFinalStage(
        '__stage0',
        [
          fieldNameColumn,
          fieldPathColumn,
          fieldValueColumn,
          fieldTypeColumn,
          'weight',
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
