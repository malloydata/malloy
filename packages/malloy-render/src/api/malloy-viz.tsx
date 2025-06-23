/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {render} from 'solid-js/web';
import type {MalloyRendererOptions} from '@/api/types';
import type {
  RenderPluginFactory,
  RenderPluginInstance,
} from '@/api/plugin-types';
import {MalloyRender} from '@/component/render';
import type {MalloyRenderProps} from '@/component/render';
import type * as Malloy from '@malloydata/malloy-interfaces';
import {RenderFieldMetadata} from '@/render-field-metadata';

export class MalloyViz {
  private disposeFn: (() => void) | null = null;
  private targetElement: HTMLElement | null = null;
  private result: Malloy.Result | null = null;
  private metadata: RenderFieldMetadata | null = null;
  private pluginRegistry: RenderPluginFactory[];

  constructor(
    private options: MalloyRendererOptions,
    pluginRegistry: RenderPluginFactory[] = []
  ) {
    this.options = options;
    this.pluginRegistry = [...pluginRegistry];
  }

  static addStylesheet(styles: string) {
    // Check if this exact stylesheet already exists in the document
    const existingStylesheet = Array.from(
      document.head.getElementsByTagName('style')
    ).find(sheet => sheet.textContent === styles);

    if (!existingStylesheet) {
      const style = document.createElement('style');
      style.setAttribute('data-malloy-viz', 'true');
      style.textContent = styles;
      document.head.appendChild(style);
    }
  }

  async getHTML(): Promise<string> {
    if (!this.result) {
      throw new Error('No result to copy');
    }

    if (!this.targetElement) {
      throw new Error('No element to copy from');
    }

    // Get dimensions from the original element
    const originalRect = this.targetElement.getBoundingClientRect();
    if (!originalRect) {
      throw new Error('No target element to measure');
    }

    // Create a temporary container off-screen
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    // Set explicit dimensions on the container
    tempContainer.style.width = `${Math.round(originalRect.width)}px`;
    tempContainer.style.height = `${Math.round(originalRect.height)}px`;
    document.body.appendChild(tempContainer);

    try {
      // Create a new MalloyViz instance with disabled virtualization
      const tempViz = new MalloyViz({
        ...this.options,
        tableConfig: {
          ...this.options.tableConfig,
          disableVirtualization: true,
        },
        dashboardConfig: {
          ...this.options.dashboardConfig,
          disableVirtualization: true,
        },
      });

      // Set the same result
      tempViz.setResult(this.result);

      // Render to the temporary container
      tempViz.render(tempContainer);

      // Wait for rendering to complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      const content = tempContainer.innerHTML;
      const styles = Array.from(document.head.getElementsByTagName('style'))
        .filter(sheet => sheet.getAttribute('data-malloy-viz') === 'true')
        .map(sheet => sheet.textContent)
        .join('\n');

      // Get the dimensions of the source element
      const rect = this.targetElement.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);

      const html = `
      <div style="width: ${width}px; height: ${height}px;">
        <style>
          ${styles}
        </style>
        <div class="malloy-viz">
          ${content}
        </div>
      </div>
    `;
      // Clean up
      tempViz.remove();
      return html;
    } catch (err) {
      return 'Malloy Renderer could not be exported to HTML';
    } finally {
      // Remove the temporary container
      document.body.removeChild(tempContainer);
    }
  }

  async copyToHTML(): Promise<void> {
    const html = await this.getHTML();
    await navigator.clipboard.writeText(html);
  }

  setResult(malloyResult: Malloy.Result): void {
    this.result = malloyResult;
    if (this.result) {
      this.metadata = new RenderFieldMetadata(
        this.result,
        this.pluginRegistry,
        this.options.pluginOptions ?? {}
      );
    }
  }

  render(targetElement?: HTMLElement): void {
    if (!this.result || !this.metadata) {
      throw new Error('Malloy Viz: No result to render');
    }
    // Remove previous render if it exists
    if (this.disposeFn) {
      this.disposeFn();
    }
    const nextTargetElement = targetElement || this.targetElement;
    if (!nextTargetElement)
      throw new Error('Malloy viz requires a target HTML element to render');
    this.targetElement = nextTargetElement;

    // Prepare the props for DOMRender
    const props: MalloyRenderProps = {
      result: this.result,
      element: this.targetElement,
      onClick: this.options.onClick,
      onDrill: this.options.onDrill,
      onError: this.options.onError,
      vegaConfigOverride: this.options.vegaConfigOverride,
      tableConfig: this.options.tableConfig,
      dashboardConfig: this.options.dashboardConfig,
      modalElement: this.options.modalElement,
      scrollEl: this.options.scrollEl,
      renderFieldMetadata: this.metadata,
    };

    // Render the SolidJS component to the target element
    this.disposeFn = render(
      () => <MalloyRender {...props} />,
      this.targetElement
    );
  }

  remove(): void {
    if (this.disposeFn) {
      this.disposeFn();
      this.disposeFn = null;
    }
    this.targetElement = null;
  }

  updateOptions(newOptions: Partial<MalloyRendererOptions>): void {
    this.options = {...this.options, ...newOptions};
  }

  getMetadata(): RenderFieldMetadata | null {
    return this.metadata;
  }

  getActivePlugin(fieldKey: string): RenderPluginInstance | null {
    if (!this.metadata) {
      return null;
    }

    const plugins = this.metadata.getPluginsForField(fieldKey);
    return plugins?.at(0) ?? null;
  }
}
