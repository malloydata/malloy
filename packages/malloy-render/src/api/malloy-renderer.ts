/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {MalloyRendererOptions} from './types';
import type {RenderPluginFactory} from './plugin-types';
import {MalloyViz} from './malloy-viz';
import {LineChartPluginFactory} from '@/plugins/line-chart/line-chart-plugin';
import {BarChartPluginFactory} from '@/plugins/bar-chart/bar-chart-plugin';
import {BigValuePluginFactory} from '@/plugins/big-value/big-value-plugin';

export class MalloyRenderer {
  private globalOptions: MalloyRendererOptions;
  private pluginRegistry: RenderPluginFactory[];

  constructor(options: MalloyRendererOptions = {}) {
    this.globalOptions = options;
    this.pluginRegistry = [
      LineChartPluginFactory,
      BarChartPluginFactory,
      BigValuePluginFactory,
      ...(options.plugins || []),
    ];
  }

  // TODO Figure out whether we should differentiate between global and viz options
  createViz(additionalOptions: Partial<MalloyRendererOptions> = {}): MalloyViz {
    const mergedOptions = {...this.globalOptions, ...additionalOptions};
    return new MalloyViz(mergedOptions, this.pluginRegistry);
  }

  // Method to update global options
  updateOptions(newOptions: Partial<MalloyRendererOptions>): void {
    this.globalOptions = {...this.globalOptions, ...newOptions};
  }

  // Method to get current global options
  getOptions(): MalloyRendererOptions {
    return {...this.globalOptions};
  }

  // Get registered plugins
  getRegisteredPlugins(): RenderPluginFactory[] {
    return [...this.pluginRegistry];
  }
}
