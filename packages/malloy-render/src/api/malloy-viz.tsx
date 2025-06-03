/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {render} from 'solid-js/web';
import type {ModelDef, QueryResult} from '@malloydata/malloy';
import type {MalloyRendererOptions} from '@/api/types';
import {MalloyRender} from '@/component/render';
import type {MalloyRenderProps} from '@/component/render';
import type * as Malloy from '@malloydata/malloy-interfaces';
import {Result, API} from '@malloydata/malloy';
import {RenderFieldMetadata} from '@/render-field-metadata';

export class MalloyViz {
  private disposeFn: (() => void) | null = null;
  private targetElement: HTMLElement | null = null;
  private result: Malloy.Result | null = null;

  private metadata: RenderFieldMetadata | null = null;

  constructor(private options: MalloyRendererOptions) {
    this.options = options;
  }

  setResult({
    malloyResult,
    result,
    queryResult,
    modelDef,
  }: {
    malloyResult?: Malloy.Result;
    result?: Result;
    queryResult?: QueryResult;
    modelDef?: ModelDef;
  }): void {
    let finalResult: Malloy.Result | null = null;

    if (malloyResult) {
      finalResult = malloyResult;
    } else if (result) finalResult = API.util.wrapResult(result);
    else if (queryResult && modelDef)
      finalResult = API.util.wrapResult(new Result(queryResult!, modelDef!));
    this.result = finalResult;
    if (this.result) this.metadata = new RenderFieldMetadata(this.result);
  }

  render(targetElement?: HTMLElement): void {
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
      result: this.result ?? undefined,
      element: this.targetElement,
      onClick: this.options.onClick,
      onDrill: this.options.onDrill,
      onError: this.options.onError,
      vegaConfigOverride: this.options.vegaConfigOverride,
      tableConfig: this.options.tableConfig,
      dashboardConfig: this.options.dashboardConfig,
      modalElement: this.options.modalElement,
      scrollEl: this.options.scrollEl,
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

  // Utility method to update options after creation
  updateOptions(newOptions: Partial<MalloyRendererOptions>): void {
    this.options = {...this.options, ...newOptions};
  }

  getMetadata(): RenderFieldMetadata | null {
    return this.metadata;
  }
}
