import {MalloyViz} from '@/api/malloy-viz';
import styles from './error-message.css?raw';

export function ErrorMessage(props: {message: string}) {
  MalloyViz.addStylesheet(styles);
  return <div class="malloy-error-message">{props.message}</div>;
}
