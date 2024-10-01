import {createEffect, createSignal, untrack} from 'solid-js';
import {VegaJSON, asVegaLiteSpec, asVegaSpec} from '../vega-types';
import {EventListenerHandler, View, parse} from 'vega';
import {compile} from 'vega-lite';
import {useResultStore} from '../result-store/result-store';

type VegaChartProps = {
  spec: VegaJSON;
  type: 'vega' | 'vega-lite';
  width?: number;
  height?: number;
  onMouseOver?: EventListenerHandler;
};

export function VegaChart(props: VegaChartProps) {
  let el!: HTMLDivElement;

  const [view, setView] = createSignal<View | null>(null);

  createEffect(() => {
    const prevView = untrack(() => view());
    if (prevView) prevView.finalize();
    const vegaspec =
      props.type === 'vega-lite'
        ? compile(asVegaLiteSpec(props.spec)).spec
        : asVegaSpec(props.spec);

    const _view = setView(
      new View(parse(vegaspec)).initialize(el).renderer('svg').hover()
    );
    if (props.onMouseOver)
      _view.addEventListener('mousemove', props.onMouseOver);
    _view.run();
    setView(_view);
  });

  createEffect(() => {
    const _view = view();
    if (_view) {
      if (props.width) _view.width(props.width);
      if (props.height) _view.height(props.height);
      _view.run();
    }
  });

  const store = useResultStore();
  createEffect(() => {
    const brushes = store.store.brushes;
    const brushValues: any[] = [];
    Object.entries(brushes).forEach(([fieldName, brushData]) => {
      brushValues.push(...brushData.map(b => b.value));
    });
    console.log({brushValues});
    if (view()) {
      view()!.signal('b', brushValues);
      view()!.run();
    }
  });

  return <div ref={el}></div>;
}
