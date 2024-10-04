import {createEffect, createSignal, untrack} from 'solid-js';
import {VegaJSON, asVegaLiteSpec, asVegaSpec} from '../vega-types';
import {EventListenerHandler, View, parse, expressionFunction} from 'vega';
import {compile} from 'vega-lite';
import {renderNumericField} from '../render-numeric-field';
import {Explore, ExploreField} from '@malloydata/malloy';
import {getFieldFromRootPath} from '../plot/util';
import {BrushData} from '../result-store/result-store';

if (!expressionFunction('renderMalloyNumber')) {
  expressionFunction(
    'renderMalloyNumber',
    (explore: Explore | ExploreField, fieldPath: string, value: number) => {
      if (explore) {
        const field = getFieldFromRootPath(explore, fieldPath);
        return field.isAtomicField()
          ? renderNumericField(field, value)
          : String(value);
      }
      return String(value);
    }
  );
}

if (!expressionFunction('getMalloyBrush')) {
  expressionFunction(
    'getMalloyBrush',
    (brushArray: BrushData[], fieldRefId: string) =>
      brushArray.find(brush => brush.fieldRefId === fieldRefId)?.value ?? null
  );
}

type VegaChartProps = {
  spec: VegaJSON;
  type: 'vega' | 'vega-lite';
  explore: Explore | ExploreField;
  width?: number;
  height?: number;
  onMouseOver?: EventListenerHandler;
  onView?: (view: View) => void;
};

export function VegaChart(props: VegaChartProps) {
  let el!: HTMLDivElement;

  const [view, setView] = createSignal<View | null>(null);

  // Create new view on spec change
  createEffect(() => {
    const _view = untrack(() => view());
    if (_view) _view.finalize();
    const vegaspec =
      props.type === 'vega-lite'
        ? compile(asVegaLiteSpec(props.spec)).spec
        : asVegaSpec(props.spec);

    const nextView = new View(parse(vegaspec))
      .initialize(el)
      .renderer('svg')
      .hover();
    if (props.onMouseOver)
      nextView.addEventListener('mousemove', props.onMouseOver);
    // nextView.addSignalListener('brushX', console.log);
    // nextView.addSignalListener('brushSeries', console.log);
    // nextView.addSignalListener('brushMeasure', console.log);
    // nextView.addSignalListener('brushOut', console.log);
    nextView.run();
    setView(nextView);
    props.onView?.(nextView);
  });

  // Update size
  createEffect(() => {
    const _view = view();
    if (_view) {
      if (props.width) _view.width(props.width);
      if (props.height) _view.height(props.height);
      _view.run();
    }
  });

  return <div ref={el}></div>;
}
