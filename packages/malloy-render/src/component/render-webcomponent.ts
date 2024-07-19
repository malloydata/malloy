import {compose, register} from 'component-register';
import {withSolid} from 'solid-element';
import {MalloyRender, MalloyRenderProps} from './render';
import css from './render.css?raw';
import tableCss from './table/table.css?raw';

const withStyles = ComponentType => {
  return (props, options) => {
    const {element} = options;
    const stylesheet = new CSSStyleSheet();
    stylesheet.replaceSync(css);
    const tableStylesheet = new CSSStyleSheet();
    tableStylesheet.replaceSync(tableCss);
    element.renderRoot.adoptedStyleSheets = [stylesheet, tableStylesheet];
    return ComponentType(props, options);
  };
};

if (!customElements.get('malloy-render')) {
  compose(
    register('malloy-render', {
      result: undefined,
      queryResult: undefined,
      modelDef: undefined,
    }),
    withStyles,
    withSolid
  )(MalloyRender);
} else {
  console.warn(
    "The custom element 'malloy-render' has already been defined. Make sure you are not loading multiple versions of the malloy-render package as they could conflict."
  );
}

declare global {
  interface HTMLElementTagNameMap {
    'malloy-render': HTMLElement & MalloyRenderProps;
  }
}
