import {compose, register} from 'component-register';
import {withSolid} from 'solid-element';
import type {MalloyRenderProps} from './render';
import {MalloyRender} from './render';
import type {MalloyModalWCProps} from './malloy-modal/malloy-modal-wc';
import {MalloyModalWC} from './malloy-modal/malloy-modal-wc';

export default function registerWebComponent({
  customElements = window.customElements,
  HTMLElement = window.HTMLElement,
}) {
  if (!customElements.get('malloy-render')) {
    compose(
      register(
        'malloy-render',
        {
          malloyResult: undefined,
          result: undefined,
          queryResult: undefined,
          modelDef: undefined,
          scrollEl: undefined,
          onClick: undefined,
          onDrill: undefined,
          vegaConfigOverride: undefined,
          tableConfig: undefined,
          dashboardConfig: undefined,
          modalElement: undefined,
        },
        {customElements, BaseElement: HTMLElement}
      ),
      withSolid
    )(MalloyRender);
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "The custom element 'malloy-render' has already been defined. Make sure you are not loading multiple versions of the malloy-render package as they could conflict."
    );
  }

  if (!customElements.get('malloy-modal')) {
    compose(
      register(
        'malloy-modal',
        {
          stylesheet: undefined,
        },
        {customElements, BaseElement: HTMLElement}
      ),
      withSolid
    )(MalloyModalWC);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'malloy-render': HTMLElement & MalloyRenderProps;
    'malloy-modal': HTMLElement & MalloyModalWCProps;
  }
}
