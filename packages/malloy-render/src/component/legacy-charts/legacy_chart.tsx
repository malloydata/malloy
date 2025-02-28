import {LineChartRendererFactory} from '../../html/line_chart';
import {createEffect} from 'solid-js';
import {ScatterChartRendererFactory} from '../../html/scatter_chart';
import {ShapeMapRendererFactory} from '../../html/shape_map';
import {SegmentMapRendererFactory} from '../../html/segment_map';
import {useResultContext} from '../result-context';
import {useConfig} from '../render';
import * as Malloy from '@malloydata/malloy-interfaces';
import {NestCell} from '../util';

const renderers = [
  LineChartRendererFactory.instance,
  ScatterChartRendererFactory.instance,
  ShapeMapRendererFactory.instance,
  SegmentMapRendererFactory.instance,
];
export function LegacyChart(props: {
  field: Malloy.DimensionInfo;
  data: NestCell;
  type: string;
}) {
  const metadata = useResultContext();
  const config = useConfig();
  const vegaConfig = config.vegaConfigOverride?.(props.type) ?? {};
  const renderer = () =>
    renderers
      .find(r => r.rendererName === props.type)
      ?.create(
        document,
        {
          // If rendering chart at root, make large. Otherwise medium because its nested
          size: metadata.rootField === props.field ? 'large' : 'medium',
        },
        {dataStyles: {}},
        props.field,
        {vegaConfigOverride: vegaConfig}
      );
  let el;
  createEffect(async () => {
    if (el && renderer()) {
      const rendererEl = await renderer()!.render(props.data, props.field);
      el.replaceChildren(rendererEl);
    }
  });
  return <div ref={el} />;
}
