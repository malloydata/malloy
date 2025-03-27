import {Portal} from 'solid-js/web';
import type {JSX, JSXElement} from 'solid-js';
import {useConfig} from '../render';

export function MalloyModal(props: {
  style?: string | JSX.CSSProperties;
  children?: JSXElement;
  ref?: HTMLDivElement | ((el: HTMLDivElement) => void);
}) {
  const config = useConfig();
  return (
    <Portal mount={config.modalElement}>
      <malloy-modal stylesheet={config.stylesheet}>
        <div ref={props.ref} style={props.style}>
          {props.children}
        </div>
      </malloy-modal>
    </Portal>
  );
}

declare module 'solid-js' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'malloy-modal': any;
    }
  }
}
