import type {ComponentOptions} from 'component-register';

export type MalloyModalWCProps = {
  stylesheet?: CSSStyleSheet;
};

export function MalloyModalWC(
  props: MalloyModalWCProps,
  {element}: ComponentOptions
) {
  const root = element.renderRoot;
  if (root instanceof ShadowRoot && props.stylesheet) {
    root.adoptedStyleSheets.push(props.stylesheet);
  }

  /*
    Move child nodes into ShadowDOM. This probably only works if modal root elements stay consistent.
  */
  const allChildren = [...element['childNodes']];
  return <div>{...allChildren}</div>;
}
