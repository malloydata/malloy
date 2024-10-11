import {
  Explore,
  ExploreField,
  QueryData,
  DateField,
  TimestampField,
} from '@malloydata/malloy';
import {addSignalListenerIfExists, VegaChart} from '../vega/vega-chart';
import {ChartTooltipEntry, RenderResultMetadata} from '../types';
import {renderTimeString} from '../render-time';
import {Tooltip} from '../tooltip/tooltip';
import {createEffect, createSignal, onMount} from 'solid-js';
import {DefaultChartTooltip} from './default-chart-tooltip';
import {EventListenerHandler, View} from 'vega';
import {
  BrushData,
  ModifyBrushOp,
  useResultStore,
  VegaBrushOut,
} from '../result-store/result-store';
import {createStore, produce} from 'solid-js/store';
import {create} from 'lodash';

export function Chart(props: {
  field: Explore | ExploreField;
  data: QueryData;
  metadata: RenderResultMetadata;
}) {
  const {field, data} = props;
  const chartProps = props.metadata.field(field).vegaChartProps!;
  const spec = structuredClone(chartProps.spec);
  // const chartData = structuredClone(data);
  const chartData = data.map(row => {
    const rec = structuredClone(row);
    // prevent structured clone from ripping this out
    // @ts-ignore
    rec.__malloyDataRecord = row.__malloyDataRecord;
    return rec;
  });
  chartProps.injectData?.(field, chartData, spec);
  // if (chartProps.specType === 'vega') {
  //   spec.data[0].values = chartData.map(row => ({
  //     ...row,
  //     x: row['brand'],
  //     y: row['Sales $'],
  //   }));
  // } else spec.data.values = chartData;

  // TODO: improve handling date/times in chart axes
  const dateTimeFields = field.allFields.filter(
    f => f.isAtomicField() && (f.isDate() || f.isTimestamp())
  ) as (DateField | TimestampField)[];
  chartData.forEach(row => {
    dateTimeFields.forEach(f => {
      const value = row[f.name];
      if (typeof value === 'number' || typeof value === 'string')
        row[f.name] = renderTimeString(
          new Date(value),
          f.isDate(),
          f.timeframe
        );
    });
  });

  const [tooltipData, setTooltipData] = createSignal<null | ChartTooltipEntry>(
    null
  );

  let tId: NodeJS.Timeout | null = null;
  const setTooltipDataDebounce = (data: ChartTooltipEntry | null) => {
    if (tId) clearTimeout(tId);
    if (data !== null) setTooltipData(data);
    else tId = setTimeout(() => setTooltipData(null), 0);
  };

  const [view, setView] = createSignal<View | null>(null);

  const mouseOverHandler: EventListenerHandler = (event, item) => {
    if (view() && item && chartProps.getTooltipData) {
      const data = chartProps.getTooltipData(item, view()!);
      setTooltipDataDebounce(data);
    } else setTooltipDataDebounce(null);
  };

  const chartId = crypto.randomUUID();
  const resultStore = useResultStore();

  const timeouts = new Map();
  const debouncedProcessBrush = (brush: VegaBrushOut) => {
    // console.log('process brush', brush.sourceId, brush.data?.value);
    const shouldDebounce = brush.hasOwnProperty('debounce');
    if (timeouts.has(brush.sourceId)) {
      clearTimeout(timeouts.get(brush.sourceId));
      timeouts.delete(brush.sourceId);
    }

    let debounceStrategy = 'always';
    if (typeof brush.debounce === 'object' && brush.debounce.strategy)
      debounceStrategy = brush.debounce.strategy;
    let debounceTime = 100;
    if (typeof brush.debounce === 'number') debounceTime = brush.debounce;
    else if (
      typeof brush.debounce === 'object' &&
      typeof brush.debounce.time === 'number'
    )
      debounceTime = brush.debounce.time;

    const isEmptyBrush = !Boolean(brush.data);

    if (isEmptyBrush) {
      if (shouldDebounce) {
        // console.count('debouncing empty');
        // empty gets debounced in either strategy
        timeouts.set(
          brush.sourceId,
          setTimeout(() => {
            // resultStore.clearBrushesBySourceId(brush.sourceId);
            resultStore.processBrushOps([
              {type: 'remove', sourceId: brush.sourceId},
            ]);
          }, debounceTime)
        );
      } else
        resultStore.processBrushOps([
          {type: 'remove', sourceId: brush.sourceId},
        ]); // resultStore.clearBrushesBySourceId(brush.sourceId);
    } else if (shouldDebounce && debounceStrategy === 'always')
      timeouts.set(
        brush.sourceId,
        setTimeout(() => {
          // resultStore.addFieldBrush(brush.data!);
          resultStore.processBrushOps([
            {type: 'add', sourceId: brush.sourceId, value: brush.data!},
          ]);
        }, debounceTime)
      );
    else
      resultStore.processBrushOps([
        {type: 'add', sourceId: brush.sourceId, value: brush.data!},
      ]); // resultStore.addFieldBrush(brush.data!);
  };

  let brushOuts: VegaBrushOut[] = [];
  createEffect(() => {
    if (view()) {
      addSignalListenerIfExists(
        view()!,
        'brushOut',
        (name, brushes: VegaBrushOut[]) => {
          brushOuts = brushes;
          brushes.forEach(brush => {
            debouncedProcessBrush(brush);
            // if (!Boolean(brush.data))
            // resultStore.clearBrushesBySourceId(brush.sourceId);
            // else resultStore.addFieldBrush(brush.data!);
          });
        }
      );
    }
  });

  createEffect(() => {
    const fieldRefIds = props.field.allFields.map(f =>
      f.isAtomicField() ? f.referenceId : null
    );

    const relevantBrushes = resultStore.store.brushes.filter(brush =>
      fieldRefIds.includes(brush.fieldRefId)
    );
    view()?.signal('brushIn', JSON.parse(JSON.stringify(relevantBrushes)));
    debouncedRunView();
    // view()?.run();
  });

  let runViewTimeId: NodeJS.Timeout | null = null;
  let lastAsyncRun: Promise<View | null> = Promise.resolve(null);
  const debouncedRunView = () => {
    if (runViewTimeId) clearTimeout(runViewTimeId);
    runViewTimeId = setTimeout(() => {
      const _view = view();
      if (_view) {
        lastAsyncRun = lastAsyncRun.then(v => {
          // console.count('run vega view');
          return v?.runAsync() || _view.runAsync();
        });
      }
    });
  };

  // Update explore signal
  createEffect(() => {
    const _view = view();
    _view?.signal('malloyExplore', props.field);
    // _view?.run();
    debouncedRunView();
  });

  console.log({spec});

  return (
    <div
      onMouseLeave={() => {
        setTooltipData(null);
        // immediately clear brush out
        // don't know the brush names because they are defined in the spec :/
        // for now, hacky store the
        resultStore.processBrushOps(
          brushOuts
            .filter(brush => brush.data?.type !== 'measure-range')
            .map(brush => ({type: 'remove', sourceId: brush.sourceId}))
        );
      }}
      style="width: fit-content; height: fit-content;"
    >
      <VegaChart
        spec={spec}
        type={chartProps.specType}
        width={chartProps.plotWidth}
        height={chartProps.plotHeight}
        onMouseOver={mouseOverHandler}
        onView={setView}
        explore={props.field}
      />
      <Tooltip show={!!tooltipData()}>
        <DefaultChartTooltip data={tooltipData()!} />
      </Tooltip>
    </div>
  );
}
