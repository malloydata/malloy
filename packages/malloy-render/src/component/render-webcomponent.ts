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

compose(
  register('malloy-render', {
    result: undefined,
    queryResult: undefined,
    modelDef: undefined,
  }),
  withStyles,
  withSolid
)(MalloyRender);

declare global {
  interface HTMLElementTagNameMap {
    'malloy-render': HTMLElement & MalloyRenderProps;
  }
}
