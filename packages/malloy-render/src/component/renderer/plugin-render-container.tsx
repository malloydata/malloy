/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {createSignal, createEffect, onCleanup} from 'solid-js';
import type {RenderPluginInstance} from '@/data_tree';
import type {
  RenderProps,
  DOMRenderPluginInstance,
  SolidJSRenderPluginInstance,
} from '@/api/plugin-types';

export interface PluginRenderContainerProps {
  plugin: RenderPluginInstance;
  renderProps: RenderProps;
  class?: string;
  style?: Record<string, string>;
}

export function PluginRenderContainer(props: PluginRenderContainerProps) {
  const [containerRef, setContainerRef] = createSignal<HTMLElement>();

  // For DOM mode, set up the effect to manipulate the container
  createEffect(() => {
    const container = containerRef();

    if (container && props.plugin.renderMode === 'dom') {
      try {
        const domPlugin = props.plugin as DOMRenderPluginInstance;
        domPlugin.renderToDOM(container, props.renderProps);

        onCleanup(() => {
          if (domPlugin.cleanup) {
            domPlugin.cleanup(container);
          }
        });
      } catch (error) {
        throw new Error(
          `Plugin ${props.plugin.name} DOM render failed: ${error}`
        );
      }
    }
  });

  if (props.plugin.renderMode === 'solidjs') {
    // Call renderComponent and wrap in container
    try {
      const solidPlugin = props.plugin as SolidJSRenderPluginInstance;
      const component = solidPlugin.renderComponent(props.renderProps);
      return (
        <div
          class={props.class}
          style={props.style}
          data-plugin={props.plugin.name}
          data-render-mode="solidjs"
        >
          {component}
        </div>
      );
    } catch (error) {
      throw new Error(
        `Plugin ${props.plugin.name} SolidJS render failed: ${error}`
      );
    }
  } else {
    // Return empty container for DOM manipulation
    return (
      <div
        ref={setContainerRef}
        class={props.class}
        style={props.style}
        data-plugin={props.plugin.name}
        data-render-mode="dom"
      />
    );
  }
}
