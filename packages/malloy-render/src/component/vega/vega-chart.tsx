import {createEffect, createSignal, untrack} from 'solid-js';
import {VegaJSON, asVegaLiteSpec, asVegaSpec} from '../vega-types';
import {
  EventListenerHandler,
  View,
  parse,
  expressionFunction,
  SignalListenerHandler,
  scale,
} from 'vega';
import {compile} from 'vega-lite';
import {renderNumericField} from '../render-numeric-field';
import {Explore, ExploreField} from '@malloydata/malloy';
import {getFieldFromRootPath} from '../plot/util';
import {BrushData} from '../result-store/result-store';
import {scaleLinear} from 'd3-scale';

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
    (brushArray: BrushData[], fieldRefId: string, type?: string) =>
      brushArray.find(brush => {
        const isField = brush.fieldRefId === fieldRefId;
        const isType = type ? brush.type === type : true;
        return isField && isType;
      })?.value ?? null
  );
}

if (!expressionFunction('getMalloyMeasureBrushes')) {
  expressionFunction(
    'getMalloyMeasureBrushes',
    (
      brushArray: BrushData[],
      fieldRefIds: string[],
      refsToFieldMap: Record<string, string>
    ) =>
      brushArray
        .filter(brush => fieldRefIds.includes(brush.fieldRefId))
        .map(brush => ({
          ...brush,
          fieldPath: refsToFieldMap[brush.fieldRefId],
        })) ?? []
  );
}

export function addSignalListenerIfExists(
  view: View,
  signal: string,
  cb: SignalListenerHandler
) {
  if (view.getState().signals?.hasOwnProperty(signal))
    view.addSignalListener(signal, cb);
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

  const chartId = crypto.randomUUID();

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

    const logSignals = (...signals: string[]) => {
      signals.forEach(signal => {
        addSignalListenerIfExists(nextView, signal, (...args) =>
          console.log(chartId, ...args)
        );
      });
    };
    // TODO: consider making this configurable from outside, rather than hardcoded here?
    // maybe same with the malloy add-ons
    nextView.signal('malloyExplore', props.explore);
    if (props.onMouseOver)
      nextView.addEventListener('mousemove', props.onMouseOver);
    // addSignalListenerIfExists(nextView, 'yRangeBrushValues', console.log);
    // nextView.addSignalListener('xRangeBrush', console.log);
    // nextView.addSignalListener('xRangeBrushValues', console.log);
    // nextView.addSignalListener('brushSeriesIn', console.log);
    // nextView.addDataListener('referenceLineData', console.log);
    // nextView.addSignalListener('testOverlay', console.log);
    // nextView.addSignalListener('brushX', console.log);
    // nextView.addSignalListener('brushMeasure', console.log);
    // nextView.addSignalListener('brushMeasureListIn', console.log);

    // nextView.addSignalListener('brushOut', (...args) =>
    //   console.log(chartId, ...args)
    // );

    // nextView.addSignalListener('brushIn', (...args) => {
    //   console.log(chartId, ...args);
    // });

    // nextView.addSignalListener('brushIn', console.log);
    // // nextView.addSignalListener('testLegend', console.log);

    logSignals(
      // keep line breaks
      ''
      // 'brushOut',
      // 'brushIn',
      // 'brushMeasureRangeIn',
      // 'brushMeasureRangeValuesIn'
    );

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
