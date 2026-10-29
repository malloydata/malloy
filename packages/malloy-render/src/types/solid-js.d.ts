import 'solid-js';
import type {ResizeDirectiveValue} from '../component/util';
declare module 'solid-js' {
  namespace JSX {
    interface Directives {
      resize: ResizeDirectiveValue;
    }
  }
}
