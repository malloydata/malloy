import registerWebComponent from './register-webcomponent';
import type {MalloyRenderProps} from './render';
export type {MalloyRenderProps} from './render';

registerWebComponent({});

declare global {
  interface HTMLElementTagNameMap {
    'malloy-render': HTMLElement & MalloyRenderProps;
  }
}
