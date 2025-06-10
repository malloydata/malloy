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
      <div ref={props.ref} style={props.style}>
        {props.children}
      </div>
    </Portal>
  );
}
