/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type * as Malloy from '@malloydata/malloy-interfaces';
import * as Core from './core';

export function compileModel(
  request: Malloy.CompileModelRequest
): Malloy.CompileModelResponse {
  return Core.compileModel(request);
}

export function compileSource(
  request: Malloy.CompileSourceRequest
): Malloy.CompileSourceResponse {
  return Core.compileSource(request);
}

export function compileQuery(
  request: Malloy.CompileQueryRequest
): Malloy.CompileQueryResponse {
  return Core.compileQuery(request);
}
