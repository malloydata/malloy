/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {DefinitionBlueprintMap} from '../functions/util';
import {TRINO_DIALECT_FUNCTIONS} from '../trino/dialect_functions';

// Athena engine version 3 runs Trino's function library; a function Athena
// has and Trino does not goes here.
export const ATHENA_DIALECT_FUNCTIONS: DefinitionBlueprintMap = {
  ...TRINO_DIALECT_FUNCTIONS,
};
