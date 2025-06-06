/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {MalloyRendererOptions} from './types';
import {MalloyViz} from './malloy-viz';

export class MalloyRenderer {
  private globalOptions: MalloyRendererOptions;

  constructor(options: MalloyRendererOptions = {}) {
    this.globalOptions = options;
  }

  // TODO Figure out whether we should differentiate between global and viz options
  createViz(additionalOptions: Partial<MalloyRendererOptions> = {}): MalloyViz {
    return new MalloyViz({...this.globalOptions, ...additionalOptions});
  }

  // Method to update global options
  updateOptions(newOptions: Partial<MalloyRendererOptions>): void {
    this.globalOptions = {...this.globalOptions, ...newOptions};
  }

  // Method to get current global options
  getOptions(): MalloyRendererOptions {
    return {...this.globalOptions};
  }
}
