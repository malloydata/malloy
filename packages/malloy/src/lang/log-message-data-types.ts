/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {FieldValueType} from '../model';

export interface Generic {
  code: 'generic';
  message: string;
}

export interface InternalError {
  code: 'internal-error';
  message: string;
}

export interface PickWhenTypeMismatch {
  code: 'pick-type-mismatch/when-does-not-match';
  // TODO 'sql native' should be a `FieldValueType` like `{ kind: 'sql native', rawType: string}`
  returnType: FieldValueType;
  whenType: FieldValueType;
}

export interface PickElseTypeMismatch {
  code: 'pick-type-mismatch/else-does-not-match';
  elseType: FieldValueType;
  returnType: FieldValueType;
}

export interface PickDefaultTypeMismatch {
  code: 'pick-type-mismatch/default-does-not-match';
  defaultType: FieldValueType;
  returnType: FieldValueType;
}

export interface PickWhenNotBoolean {
  code: 'pick-type-mismatch/when-not-boolean';
  whenType: FieldValueType;
}

export type PickTypeMismatch =
  | PickWhenTypeMismatch
  | PickElseTypeMismatch
  | PickDefaultTypeMismatch
  | PickWhenNotBoolean;

export interface PickMissingElse {
  code: 'invalid-pick/missing-else';
}

export interface PickNoValue {
  code: 'invalid-pick/no-value';
}

export interface PickPartial {
  code: 'invalid-pick/illegal-partial';
}

export type InvalidPick = PickMissingElse | PickNoValue | PickPartial;

export interface ExperimentalFeatureNotEnabled {
  code: 'experimental/feature-not-enabled';
  experimentId: string;
}

export interface ExperimentalDialectNotEnabled {
  code: 'experimental/dialect-not-enabled';
  dialectName: string;
}

export type ExperimentNotEnabled =
  | ExperimentalFeatureNotEnabled
  | ExperimentalDialectNotEnabled;

export interface GlobalRedefinition {
  code: 'global-redefinition';
  name: string;
}

export type Any =
  | Generic
  | InternalError
  | InvalidPick
  | PickTypeMismatch
  | ExperimentNotEnabled
  | GlobalRedefinition;

export function writeLogMessage(data: Any): string {
  switch (data.code) {
    case 'generic':
      return data.message;
    case 'internal-error':
      return `INTERNAL ERROR IN TRANSLATION: ${data.message}`;
    case 'pick-type-mismatch/when-does-not-match':
      return `pick type \`${data.whenType}\`, expected \`${data.returnType}\``;
    case 'pick-type-mismatch/when-not-boolean':
      return `when expression must be boolean, bot \`${data.whenType}\``;
    case 'pick-type-mismatch/else-does-not-match':
      return `else type \`${data.elseType}\`, expected \`${data.returnType}\``;
    case 'pick-type-mismatch/default-does-not-match':
      return `pick default type \`${data.defaultType}\`, expected \`${data.returnType}\``;
    case 'invalid-pick/missing-else':
      return 'pick incomplete, missing `else`';
    case 'invalid-pick/no-value':
      return 'pick with no value can only be used with apply';
    case 'invalid-pick/illegal-partial':
      return 'pick with partial when can only be used with apply';
    case 'experimental/feature-not-enabled':
      return `Experimental flag '${data.experimentId}' is not set, feature not available`;
    case 'experimental/dialect-not-enabled':
      return `Requires compiler flag '##! experimental.dialect.${data.dialectName}'`;
    case 'global-redefinition':
      return `Cannot redefine '${data.name}', which is in global namespace`;
  }
  throw new Error(`Unknown log message code ${data}`);
}
