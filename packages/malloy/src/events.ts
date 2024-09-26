/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

export interface MalloyEvent {
  id: string;
  data: unknown;
}

export interface EventStream {
  emit: (event: MalloyEvent) => void;
}
