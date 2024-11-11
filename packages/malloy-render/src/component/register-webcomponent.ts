import {compose, register} from 'component-register';
import {withSolid} from 'solid-element';
import {MalloyRender, MalloyRenderProps} from './render';

export default function registerWebComponent({
  customElements = window.customElements,
  HTMLElement = window.HTMLElement,
}) {
  if (!customElements.get('malloy-render')) {
    compose(
      register(
        'malloy-render',
        {
          result: undefined,
          queryResult: undefined,
          modelDef: undefined,
          scrollEl: undefined,
          onClick: undefined,
          vegaConfigOverride: undefined,
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
}

declare global {
  interface HTMLElementTagNameMap {
    'malloy-render': HTMLElement & MalloyRenderProps;
  }
}
