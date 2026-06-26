/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

export * from './malloy_types';

import type {ModelRootInterface} from './query_node';
import {QueryField, QueryStruct} from './query_node';
import {exprToSQL} from './expression_compiler';
import {QueryQuery} from './query_query';
import {FieldInstanceField} from './field_instance';
import {QueryModelImpl} from './query_model_impl';

function getLookupFun(
  mri: ModelRootInterface
): (name: string) => QueryStruct | undefined {
  return (name: string) => mri.structs.get(name);
}

FieldInstanceField.registerExpressionCompiler(exprToSQL);
QueryStruct.registerTurtleFieldMaker((field, parent) =>
  QueryQuery.makeQuery(
    field,
    parent,
    undefined,
    false,
    getLookupFun(parent.getModel())
  )
);

// Note the internal vs. external naming of QueryModel, this is another
// circular dependency problem which might have a better fix in the future.
export {QueryField, QueryStruct, QueryQuery, QueryModelImpl as QueryModel};

export {
  getResultStructDefForQuery,
  getResultStructDefForView,
} from './query_model_impl';
export {
  indent,
  composeSQLExpr,
  makeDigest,
  mkModelDef,
  mkModelID,
  pathToKey,
  typeDefToString,
} from './utils';
export {getModelAnnotations} from './annotation_utils';
export {constantExprToSQL} from './constant_expression_compiler';
export {predicateExprToSQL} from './predicate_expression_compiler';
export type {PredicateExpressionResult} from './predicate_expression_compiler';
export {getCompiledSQL} from './sql_compiled';
export {MalloyCompileError} from './malloy_compile_error';
export {
  mkSourceID,
  mkBuildID,
  mkQuerySourceDef,
  mkSQLSourceDef,
  mkTableSourceDef,
  resolveSourceID,
  resolveSourceRef,
  sourceNamespaceReference,
  registerSource,
  hasSourceRegistryEntry,
} from './source_def_utils';
export type {NamespaceReference} from './source_def_utils';
