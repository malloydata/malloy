/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from '@malloydata/malloy-interfaces';
import * as Core from './core';

export async function compileModel(
  request: Malloy.CompileModelRequest
): Promise<Malloy.CompileModelResponse> {
  return Core.compileModel(request);
}

export async function compileSource(
  request: Malloy.CompileSourceRequest
): Promise<Malloy.CompileSourceResponse> {
  return Core.compileSource(request);
}

export async function compileQuery(
  request: Malloy.CompileQueryRequest
): Promise<Malloy.CompileQueryResponse> {
  return Core.compileQuery(request);
}
