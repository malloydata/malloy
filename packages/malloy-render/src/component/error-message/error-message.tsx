import {useConfig} from '../render';
import css from './error-message.css?raw';

export function ErrorMessage(props: {message: string}) {
  const config = useConfig();
  config.addCSSToShadowRoot(css);
  return <div class="malloy-error-message">{props.message}</div>;
}
