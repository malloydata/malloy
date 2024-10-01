import {
  Explore,
  ExploreField,
  QueryData,
  DateField,
  TimestampField,
} from '@malloydata/malloy';
import {VegaChart} from '../vega/vega-chart';
import {ChartTooltipEntry, RenderResultMetadata} from '../types';
import {renderTimeString} from '../render-time';
import {Tooltip} from '../tooltip/tooltip';
import {createSignal} from 'solid-js';
import {DefaultChartTooltip} from './default-chart-tooltip';
import {EventListenerHandler} from 'vega';
import {BrushData, useResultStore} from '../result-store/result-store';

export function Chart(props: {
  field: Explore | ExploreField;
  data: QueryData;
  metadata: RenderResultMetadata;
}) {
  const {field, data} = props;
  const store = useResultStore();
  const chartProps = props.metadata.field(field).vegaChartProps!;
  const spec = structuredClone(chartProps.spec);
  const chartData = structuredClone(data);
  if (chartProps.specType === 'vega') {
    spec.data[0].values = chartData;
  } else spec.data.values = chartData;

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

  // Should be faster if we can update the dataset directly??
  const spec2 = () => {
    const spec = structuredClone(chartProps.spec);
    const chartData = structuredClone(data);
    if (chartProps.specType === 'vega') {
      spec.data[0].values = chartData;
    } else spec.data.values = chartData;

    const allFieldPaths = field.allFields.map(f => f.fieldPath.join('.'));
    const validBrushes = () =>
      Object.entries(store.store.brushes).filter(([fieldName, brushes]) => {
        return allFieldPaths.includes(fieldName);
      });
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

      row.__brushed = false;

      validBrushes().forEach(([fieldName, brushes]) => {
        const localFieldName = fieldName.split('.').at(-1);
        if (localFieldName)
          row.__brushed = brushes.some(b => b.value === row[localFieldName]);
      });
    });
    return spec;
  };

  // createEffect(() => {
  //   console.log('spec2', spec2());
  // });

  const allFieldPaths = field.allFields.map(f => f.fieldPath.join('.'));
  const validBrushes = () =>
    Object.entries(store.store.brushes).filter(([fieldName, brushes]) => {
      return allFieldPaths.includes(fieldName);
    });

  // createEffect(() => {
  //   console.log('VB2', JSON.parse(JSON.stringify(validBrushes())));
  // });

  const [tooltipData, setTooltipData] = createSignal<
    null | ChartTooltipEntry[]
  >(null);

  let tId: NodeJS.Timeout | null = null;
  const setTooltipDataDebounce = (data: ChartTooltipEntry[] | null) => {
    if (tId) clearTimeout(tId);
    if (data !== null) setTooltipData(data);
    else tId = setTimeout(() => setTooltipData(null), 50);
  };

  // createEffect(() => {
  //   console.log(JSON.parse(JSON.stringify(store.store)));
  // });
  const chartId = crypto.randomUUID();
  const mouseOverHandler: EventListenerHandler = (event, item) => {
    if (item?.datum && chartProps.getTooltipData) {
      const data = chartProps.getTooltipData(item);
      // console.log({data});
      setTooltipDataDebounce(data);
      if (data)
        for (const entry of data) {
          if (entry.field.isAtomicField() && entry.field.sourceWasDimension()) {
            // console.log({entry});
            const brushData: BrushData = {
              value: entry.value,
              id: chartId,
            };
            store.addFieldBrush(entry.field.fieldPath.join('.'), brushData);
          }
        }
    } else {
      setTooltipDataDebounce(null);
      store.clearBrushesById(chartId);
    }
  };

  // console.log({spec});

  return (
    <div
      onMouseLeave={() => {
        setTooltipData(null);
        store.clearBrushesById(chartId);
      }}
      style="width: fit-content; height: fit-content;"
    >
      <VegaChart
        spec={spec}
        // spec={spec2()}
        type={chartProps.specType}
        width={chartProps.plotWidth}
        height={chartProps.plotHeight}
        onMouseOver={mouseOverHandler}
      />
      <Tooltip show={!!tooltipData()}>
        <DefaultChartTooltip data={tooltipData()!} />
      </Tooltip>
    </div>
  );
}
