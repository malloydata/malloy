import {Portal} from 'solid-js/web';
import {JSX, JSXElement} from 'solid-js';
import {useConfig} from '../render';

export function MalloyModal(props: {
  style?: string | JSX.CSSProperties;
  children?: JSXElement;
  ref?: HTMLDivElement | ((el: HTMLDivElement) => void);
}) {
  const config = useConfig();
  return (
    <Portal mount={config.modalElement}>
      <div ref={props.ref} style={props.style}>
        <malloy-modal stylesheet={config.stylesheet}>
          <div>{props.children}</div>
        </malloy-modal>
      </div>
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
