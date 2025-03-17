/* eslint-disable no-console */
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

import {inspect} from 'util';
import type {
  DocumentLocation,
  FieldDef,
  ModelDef,
  NamedModelObject,
  PipeSegment,
  Query,
  QueryFieldDef,
  StructDef,
  TurtleDef,
  SourceDef,
  JoinBase,
  TableSourceDef,
  SQLSourceDef,
  NumberTypeDef,
} from '../../model/malloy_types';
import {
  isQuerySegment,
  isSourceDef,
  mkArrayDef,
} from '../../model/malloy_types';
import {ExpressionDef, MalloyElement} from '../ast';
import type {NameSpace} from '../ast/types/name-space';
import type {ModelEntry} from '../ast/types/model-entry';
import {MalloyChildTranslator, MalloyTranslator} from '../parse-malloy';
import type {
  DataRequestResponse,
  SQLSourceRequest,
  TranslateResponse,
} from '../translate-response';
import {StaticSourceSpace} from '../ast/field-space/static-space';
import type {ExprValue} from '../ast/types/expr-value';
import {GlobalNameSpace} from '../ast/types/global-name-space';
import type {
  LogSeverity,
  MessageCode,
  MessageParameterType,
} from '../parse-log';
import type {EventStream} from '../../runtime_types';
import {sqlKey} from '../../model/sql_block';

// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
export function pretty(thing: any): string {
  return inspect(thing, {breakLength: 72, depth: Infinity});
}
const intType: NumberTypeDef = {type: 'number', numberType: 'integer'};
const mockSchema: Record<string, SourceDef> = {
  'aTable': {
    type: 'table',
    name: 'aTable',
    dialect: 'standardsql',
    tablePath: 'aTable',
    connection: 'test',
    fields: [
      {type: 'string', name: 'astr'},
      {type: 'number', name: 'af', numberType: 'float'},
      {...intType, name: 'ai'},
      {type: 'date', name: 'ad'},
      {type: 'boolean', name: 'abool'},
      {type: 'timestamp', name: 'ats'},
      {type: 'sql native', name: 'aun'},
      {type: 'sql native', name: 'aweird', rawType: 'weird'},
      {
        type: 'array',
        name: 'astruct',
        elementTypeDef: {type: 'record_element'},
        join: 'many',
        fields: [
          {
            name: 'column',
            type: 'number',
            numberType: 'integer',
          },
        ],
      },
      {
        type: 'record',
        name: 'aninline',
        fields: [{...intType, name: 'column'}],
        join: 'one',
        matrixOperation: 'left',
      },
      mkArrayDef(intType, 'ais'),
    ],
  },
  'malloytest.carriers': {
    type: 'table',
    name: 'malloytest.carriers',
    dialect: 'standardsql',
    tablePath: 'malloytest.carriers',
    connection: 'bigquery',
    fields: [
      {name: 'code', type: 'string'},
      {name: 'name', type: 'string'},
      {name: 'nickname', type: 'string'},
    ],
    as: 'carriers',
  },
  'malloytest.flights': {
    type: 'table',
    name: 'malloytest.flights',
    dialect: 'standardsql',
    tablePath: 'malloytest.flights',
    connection: 'bigquery',
    fields: [
      {name: 'carrier', type: 'string'},
      {name: 'origin', type: 'string'},
      {name: 'destination', type: 'string'},
      {name: 'flight_num', type: 'string'},
      {name: 'flight_time', type: 'number', numberType: 'integer'},
      {name: 'tail_num', type: 'string'},
      {name: 'dep_time', type: 'timestamp'},
      {name: 'arr_time', type: 'timestamp'},
      {name: 'dep_delay', type: 'number', numberType: 'integer'},
      {name: 'arr_delay', type: 'number', numberType: 'integer'},
      {name: 'taxi_out', type: 'number', numberType: 'integer'},
      {name: 'taxi_in', type: 'number', numberType: 'integer'},
      {name: 'distance', type: 'number', numberType: 'integer'},
      {name: 'cancelled', type: 'string'},
      {name: 'diverted', type: 'string'},
      {name: 'id2', type: 'number', numberType: 'integer'},
    ],
    as: 'flights',
  },
  'malloytest.airports': {
    type: 'table',
    name: 'malloytest.airports',
    dialect: 'standardsql',
    tablePath: 'malloytest.airports',
    connection: 'bigquery',
    fields: [
      {name: 'id', type: 'number', numberType: 'integer'},
      {name: 'code', type: 'string'},
      {name: 'site_number', type: 'string'},
      {name: 'fac_type', type: 'string'},
      {name: 'fac_use', type: 'string'},
      {name: 'faa_region', type: 'string'},
      {name: 'faa_dist', type: 'string'},
      {name: 'city', type: 'string'},
      {name: 'county', type: 'string'},
      {name: 'state', type: 'string'},
      {name: 'full_name', type: 'string'},
      {name: 'own_type', type: 'string'},
      {name: 'longitude', type: 'number', numberType: 'float'},
      {name: 'latitude', type: 'number', numberType: 'float'},
      {name: 'elevation', type: 'number', numberType: 'integer'},
      {name: 'aero_cht', type: 'string'},
      {name: 'cbd_dist', type: 'number', numberType: 'integer'},
      {name: 'cbd_dir', type: 'string'},
      {name: 'act_date', type: 'string'},
      {name: 'cert', type: 'string'},
      {name: 'fed_agree', type: 'string'},
      {name: 'cust_intl', type: 'string'},
      {name: 'c_ldg_rts', type: 'string'},
      {name: 'joint_use', type: 'string'},
      {name: 'mil_rts', type: 'string'},
      {name: 'cntl_twr', type: 'string'},
      {name: 'major', type: 'string'},
    ],
    as: 'airports',
  },
};
export const aTableDef = mockSchema['aTable'];

const bJoinedIntoA: TableSourceDef & JoinBase = {
  type: 'table',
  name: 'aTable',
  dialect: 'standardsql',
  tablePath: 'aTable',
  connection: 'test',
  as: 'b',
  join: 'one',
  matrixOperation: 'left',
  onExpression: {
    node: '=',
    kids: {
      left: {node: 'field', path: ['astr']},
      right: {node: 'field', path: ['b', 'astr']},
    },
  },
  fields: aTableDef.fields,
};

/**
 * When translating partial trees, there will not be a document node
 * to handle namespace requests, this stands in for document in that case.
 */
class TestRoot extends MalloyElement implements NameSpace {
  elementType = 'test root';
  globalNameSpace: NameSpace = new GlobalNameSpace();

  constructor(
    child: MalloyElement,
    forTranslator: MalloyTranslator,
    private modelDef: ModelDef
  ) {
    super({child});
    this.setTranslator(forTranslator);
  }

  namespace(): NameSpace {
    return this;
  }

  getEntry(name: string): ModelEntry | undefined {
    const global = this.globalNameSpace.getEntry(name);
    if (global) return global;
    const struct = this.modelDef.contents[name];
    if (isSourceDef(struct)) {
      const exported = this.modelDef.exports.includes(name);
      return {entry: struct, exported};
    }
  }

  setEntry(_name: string, _val: ModelEntry): void {
    throw new Error("Can't add entries to test model def");
  }
}

export class TestChildTranslator extends MalloyChildTranslator {
  translate(): TranslateResponse {
    if (this.root instanceof TestTranslator) {
      return super.translate(this.root.internalModel);
    } else {
      return super.translate();
    }
  }

  addChild(url: string): void {
    if (!this.childTranslators.get(url)) {
      const child = new TestChildTranslator(url, this.root);
      this.childTranslators.set(url, child);
    }
  }
}

const testURI = 'internal://test/langtests/root.malloy';
export class TestTranslator extends MalloyTranslator {
  allDialectsEnabled = true;
  testRoot?: TestRoot;
  /*
   * All test source files can assume that an import of this

   *
   * Also the following tables will be available on _db_
   *   aTable, malloytest.carriers, malloytest.flights, malloytest.airports
   *
   *   source: a is _db_.table('aTable') extend { primary_key: astr }
   *   source: b is a
   *   source: ab is a extend {
   *     join_one: b with astr
   *     measure: acount is count()
   *     query: aturtle is { group_by: astr; aggregate: acount }
   *   }
   */

  internalModel: ModelDef = {
    name: testURI,
    exports: [],
    queryList: [],
    dependencies: {},
    contents: {
      _db_: {type: 'connection', name: '_db_'},
      a: {...aTableDef, primaryKey: 'astr', as: 'a'},
      b: {...aTableDef, primaryKey: 'astr', as: 'b'},
      ab: {
        ...aTableDef,
        primaryKey: 'astr',
        fields: [
          ...aTableDef.fields,
          bJoinedIntoA,
          {
            type: 'number',
            name: 'acount',
            numberType: 'integer',
            expressionType: 'aggregate',
            e: {node: 'aggregate', function: 'count', e: {node: ''}},
            code: 'count()',
          },
          {
            type: 'turtle',
            name: 'aturtle',
            pipeline: [
              {
                type: 'reduce',
                queryFields: [
                  {type: 'fieldref', path: ['astr']},
                  {type: 'fieldref', path: ['acount']},
                ],
              },
            ],
          },
        ],
      },
    },
  };

  constructor(
    readonly testSrc: string,
    importBaseURL: string | null = null,
    eventStream: EventStream | null = null,
    rootRule = 'malloyDocument',
    internalModel?: ModelDef
  ) {
    super(testURI, importBaseURL, null, eventStream);
    this.grammarRule = rootRule;
    this.importZone.define(testURI, testSrc);
    if (internalModel !== undefined) {
      this.internalModel = internalModel;
    }
    for (const tableName in mockSchema) {
      this.schemaZone.define(tableName, mockSchema[tableName]);
      this.schemaZone.define(`_db_:${tableName}`, mockSchema[tableName]);
    }
  }

  translate(): TranslateResponse {
    return super.translate(this.internalModel);
  }

  addChild(url: string): void {
    if (!this.childTranslators.get(url)) {
      const child = new TestChildTranslator(url, this);
      this.childTranslators.set(url, child);
    }
  }

  ast(): MalloyElement | undefined {
    const astAsk = this.astStep.step(this);
    if (astAsk.ast) {
      if (this.grammarRule !== 'malloyDocument') {
        this.testRoot = new TestRoot(astAsk.ast, this, this.internalModel);
      }
      return astAsk.ast;
    }
    this.explainFailure();
  }

  private explainFailure() {
    let mysterious = true;
    if (this.logger.empty()) {
      const whatImports = this.importZone.getUndefined();
      if (whatImports) {
        mysterious = false;
        this.logger.log({
          code: 'missing-imports',
          at: this.defaultLocation(),
          message: `Missing imports: ${whatImports.join(',')}`,
          severity: 'error',
        });
      }
      const needThese = this.schemaZone.getUndefined();
      if (needThese) {
        mysterious = false;
        this.logger.log({
          code: 'missing-schema',
          at: this.defaultLocation(),
          message: `Missing schema: ${needThese.join(',')}`,
          severity: 'error',
        });
      }
      if (mysterious) {
        this.logger.log({
          code: 'mysterious-translation-failure',
          at: this.defaultLocation(),
          message: 'mysterious translation failure',
          severity: 'error',
        });
      }
    }
  }

  get nameSpace(): Record<string, NamedModelObject> {
    const gotModel = this.translate();
    return gotModel?.modelDef?.contents || {};
  }

  exploreFor(exploreName: string): StructDef {
    const explore = this.nameSpace[exploreName];
    if (explore && isSourceDef(explore)) {
      return explore;
    }
    throw new Error(`Expected model to contain source '${exploreName}'`);
  }

  static inspectCompile = false;
  compile(): void {
    const compileTo = this.translate();
    if (compileTo.modelDef && TestTranslator.inspectCompile) {
      console.log('MODEL: ', pretty(compileTo.modelDef));
    }
    // All the stuff to ask the ast for a translation is already in TestTranslator
  }

  unresolved(): DataRequestResponse {
    return this.importsAndTablesStep.step(this);
  }

  getSourceDef(srcName: string): SourceDef | undefined {
    const t = this.translate().modelDef;
    const s = t?.contents[srcName];
    if (s && isSourceDef(s)) {
      return s;
    }
    return undefined;
  }

  getQuery(queryName: string | number): Query | undefined {
    const t = this.translate().modelDef;
    if (t) {
      const s =
        typeof queryName === 'string'
          ? t.contents[queryName]
          : t.queryList[queryName];
      if (s?.type === 'query') {
        return s;
      }
    }
    return undefined;
  }
}

export class BetaExpression extends TestTranslator {
  private compiled?: ExprValue;
  constructor(
    src: string,
    model?: ModelDef,
    readonly sourceName: string = 'ab'
  ) {
    super(src, null, null, 'debugExpr', model);
  }

  private testFS() {
    const aStruct = this.internalModel.contents[this.sourceName];
    if (isSourceDef(aStruct)) {
      const tstFS = new StaticSourceSpace(aStruct);
      return tstFS;
    } else {
      throw new Error("Can't get simple namespace for expression tests");
    }
  }

  compile(): void {
    const exprAst = this.ast();
    if (exprAst instanceof ExpressionDef) {
      const tstFS = this.testFS();
      const exprDef = exprAst.getExpression(tstFS);
      this.compiled = exprDef;
      if (TestTranslator.inspectCompile) {
        console.log('EXPRESSION: ', pretty(exprDef));
      }
    } else if (this.logger.hasErrors()) {
      return;
    } else {
      const whatIsIt = exprAst?.toString() || 'NO AST GENERATED';
      throw new Error(`Not an expression: ${whatIsIt}`);
    }
  }

  generated(): ExprValue {
    if (!this.compiled) {
      throw new Error('Must compile expression before fetching generated code');
    }
    return this.compiled;
  }
}

export function getExplore(modelDef: ModelDef, name: string): StructDef {
  return modelDef.contents[name] as StructDef;
}

export function getModelQuery(modelDef: ModelDef, name: string): Query {
  return modelDef.contents[name] as Query;
}

export function getFieldDef(source: StructDef, name: string): FieldDef {
  for (const f of source.fields) {
    if (f.as ?? f.name === name) {
      return f;
    }
  }
  throw new Error(`Compiled source did not contain expected field '${name}'`);
}

export function getQueryFieldDef(
  query: PipeSegment,
  name: string
): QueryFieldDef {
  if (isQuerySegment(query)) {
    for (const f of query.queryFields) {
      if (f.type === 'fieldref') {
        if (name === f.path[f.path.length - 1]) {
          return f;
        }
      } else if (f.as ?? f.name === name) {
        return f;
      }
    }
  }
  throw new Error(`Compiled query did not contain expected field '${name}'`);
}

// TODO "as" is almost always a code smell ...
export function getQueryField(structDef: StructDef, name: string): TurtleDef {
  return getFieldDef(structDef, name) as TurtleDef;
}

// TODO "as" is almost always a code smell ...
export function getJoinField(structDef: StructDef, name: string): StructDef {
  return getFieldDef(structDef, name) as StructDef;
}

export interface MarkedSource {
  code: string;
  locations: DocumentLocation[];
  translator?: TestTranslator;
}

interface HasTranslator<TT extends TestTranslator> extends MarkedSource {
  translator: TT;
}

export function expr(
  unmarked: TemplateStringsArray,
  ...marked: string[]
): HasTranslator<BetaExpression> {
  const ms = markSource(unmarked, ...marked);
  return {
    ...ms,
    translator: new BetaExpression(ms.code),
  };
}

export function model(
  unmarked: TemplateStringsArray,
  ...marked: string[]
): HasTranslator<TestTranslator> {
  const ms = markSource(unmarked, ...marked);
  return {
    ...ms,
    translator: new TestTranslator(ms.code),
  };
}

export function makeModelFunc(options: {
  model?: ModelDef;
  prefix?: string;
  wrap?: (code: string) => string;
}) {
  return function model(
    unmarked: TemplateStringsArray,
    ...marked: string[]
  ): HasTranslator<TestTranslator> {
    const ms = markSource(unmarked, ...marked);
    return {
      ...ms,
      translator: new TestTranslator(
        (options.prefix ?? '') +
          (options.wrap ? options.wrap(ms.code) : ms.code),
        null,
        null,
        undefined,
        options?.model
      ),
    };
  };
}

export function makeExprFunc(model: ModelDef, sourceName: string) {
  return function expr(
    unmarked: TemplateStringsArray,
    ...marked: string[]
  ): HasTranslator<TestTranslator> {
    const ms = markSource(unmarked, ...marked);
    return {
      ...ms,
      translator: new BetaExpression(ms.code, model, sourceName),
    };
  };
}

export function markSource(
  unmarked: TemplateStringsArray,
  ...marked: string[]
): MarkedSource {
  let code = '';
  const locations: DocumentLocation[] = [];
  for (let index = 0; index < marked.length; index++) {
    const mark = marked[index];
    code += unmarked[index];
    const lines = code.split('\n');
    const start = {
      line: lines.length - 1,
      character: lines[lines.length - 1].length,
    };
    const bitLines = mark.split('\n');
    const location = {
      url: testURI,
      range: {
        start,
        end: {
          line: start.line + bitLines.length - 1,
          character:
            bitLines.length === 1
              ? start.character + mark.length
              : bitLines[bitLines.length - 1].length,
        },
      },
    };
    locations.push(location);
    code += mark;
  }
  code += unmarked[marked.length];
  return {code, locations};
}

export function getSelectOneStruct(sqlBlock: SQLSourceRequest): {
  [key: string]: SQLSourceDef;
} {
  const key = sqlKey(sqlBlock.connection, sqlBlock.selectStr);
  return {
    [key]: {
      type: 'sql_select',
      name: key,
      dialect: 'standardsql',
      connection: 'bigquery',
      selectStr: sqlBlock.selectStr,
      fields: [{type: 'number', name: 'one'}],
    },
  };
}

export function error<T extends MessageCode>(
  code: T,
  data?: MessageParameterType<T>
): {code: T; data: MessageParameterType<T> | undefined; severity: LogSeverity} {
  return {code, data, severity: 'error'};
}

export function warning<T extends MessageCode>(
  code: T,
  data?: MessageParameterType<T>
): {code: T; data: MessageParameterType<T> | undefined; severity: LogSeverity} {
  return {code, data, severity: 'warn'};
}

export function errorMessage(message: string | RegExp): {
  message: string | RegExp;
  severity: LogSeverity;
} {
  return {message, severity: 'error'};
}

export function warningMessage(message: string | RegExp): {
  message: string | RegExp;
  severity: LogSeverity;
} {
  return {message, severity: 'warn'};
}
