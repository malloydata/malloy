/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {MalloyRendererOptions} from './types';
import type {RenderPluginFactory, RenderPluginInstance} from './plugin-types';
import {MalloyViz} from './malloy-viz';
import {LineChartPluginFactory} from '@/plugins/line-chart/line-chart-plugin';

// Helper type to extract the union of all possible plugin instances from a tuple of factories
type AllPluginsFromFactories<
  TFactories extends readonly RenderPluginFactory<any>[],
> = ReturnType<TFactories[number]['create']>; // Assuming `create` is the method that returns the instance

// Helper type to create the Name-to-Plugin map from a union of plugin instances
type PluginNameMapFromPlugins<TPluginsUnion extends RenderPluginInstance<any>> =
  {
    [P in TPluginsUnion as P['name']]: P;
  };

export class MalloyRenderer<
  TAdditionalPlugins extends readonly RenderPluginFactory<any>[] = [],
> {
  private globalOptions: MalloyRendererOptions;
  private pluginRegistry: [
    typeof LineChartPluginFactory,
    ...TAdditionalPlugins,
  ];

  constructor(
    options?: MalloyRendererOptions & {plugins?: TAdditionalPlugins}
  ) {
    this.globalOptions = options || {};
    const additionalPlugins: TAdditionalPlugins = (options?.plugins ??
      []) as TAdditionalPlugins;
    // THE FIX IS HERE: Stronger type assertion
    this.pluginRegistry = [LineChartPluginFactory, ...additionalPlugins] as [
      typeof LineChartPluginFactory,
      ...TAdditionalPlugins,
    ];
  }

  // TODO Figure out whether we should differentiate between global and viz options
  createViz(
    additionalOptions: Partial<MalloyRendererOptions> = {}
  ): MalloyViz<typeof this.pluginRegistry> {
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
  getRegisteredPlugins(): typeof this.pluginRegistry {
    return [...this.pluginRegistry] as typeof this.pluginRegistry;
  }
}
