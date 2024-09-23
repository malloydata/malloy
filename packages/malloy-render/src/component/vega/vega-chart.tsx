import {createEffect} from 'solid-js';
import {VegaJSON, asVegaLiteSpec, asVegaSpec} from '../vega-types';
import {EventListenerHandler, View, parse} from 'vega';
import {compile} from 'vega-lite';

type VegaChartProps = {
  spec: VegaJSON;
  type: 'vega' | 'vega-lite';
  width?: number;
  height?: number;
  onMouseOver?: EventListenerHandler;
};

export function VegaChart(props: VegaChartProps) {
  let el!: HTMLDivElement;

  let view: View | null = null;

  createEffect(() => {
    if (view) view.finalize();
    const vegaspec =
      props.type === 'vega-lite'
        ? compile(asVegaLiteSpec(props.spec)).spec
        : asVegaSpec(props.spec);

    view = new View(parse(vegaspec)).initialize(el).renderer('svg').hover();
    if (props.onMouseOver)
      view.addEventListener('mouseover', props.onMouseOver);
    // view.addSignalListener('signalA', console.log);
    // console.log({state: view.getState()});
    // view.addSignalListener('signalC', console.log);
    // view.addSignalListener('t2', console.log);
    // view.addSignalListener('interactions', (signal, value) =>
    //   console.log(signal, value[0].value)
    // );
    view.run();
  });

  createEffect(() => {
    if (view) {
      if (props.width) view.width(props.width);
      if (props.height) view.height(props.height);
      view.run();
    }
  });

  return <div ref={el}></div>;
}
