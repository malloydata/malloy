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

export type {
  DialectFunctionOverloadDef,
  DefinitionBlueprint,
  DefinitionBlueprintMap,
  OverloadedDefinitionBlueprint,
} from './functions/util';
export {
  arg,
  anyExprType,
  makeParam,
  overload,
  minScalar,
  minAggregate,
  maxScalar,
  spread,
  param,
  variadicParam,
  literal,
  sql,
} from './functions/util';
export {Dialect, qtz} from './dialect';
export type {DialectFieldList, QueryInfo, FieldReferenceType} from './dialect';
export {StandardSQLDialect} from './standardsql';
export {PostgresDialect} from './postgres';
export {TSQLDialect} from './tsql';
export {DuckDBDialect} from './duckdb';
export {SnowflakeDialect} from './snowflake';
export {TrinoDialect} from './trino';
export {MySQLDialect} from './mysql';
export {getDialect, registerDialect} from './dialect_map';
export {getMalloyStandardFunctions} from './functions';
export type {MalloyStandardFunctionImplementations} from './functions';
export type {TinyToken} from './tiny_parser';
export {TinyParser} from './tiny_parser';
