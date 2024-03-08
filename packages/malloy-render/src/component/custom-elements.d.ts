import 'solid-js';
import {DataArray} from '@malloydata/malloy';
import {RenderResultMetadata} from '../render-result-metadata';

// TODO: This is temporary until we move charting into Solid components
declare module 'solid-js' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'malloy-bar-chart': {
        data: DataArray;
        metadata: RenderResultMetadata;
      };
    }
  }
}
