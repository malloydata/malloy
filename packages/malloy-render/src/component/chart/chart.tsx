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
import {createEffect, createSignal, onMount} from 'solid-js';
import {DefaultChartTooltip} from './default-chart-tooltip';
import {EventListenerHandler, View} from 'vega';

export function Chart(props: {
  field: Explore | ExploreField;
  data: QueryData;
  metadata: RenderResultMetadata;
}) {
  const {field, data} = props;
  const chartProps = props.metadata.field(field).vegaChartProps!;
  const spec = structuredClone(chartProps.spec);
  const chartData = structuredClone(data);
  chartProps.injectData(field, chartData, spec);
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

  console.log({spec});

  return (
    <div
      onMouseLeave={() => {
        setTooltipData(null);
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
