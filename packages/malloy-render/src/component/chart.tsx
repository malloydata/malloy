import {
  Explore,
  ExploreField,
  QueryData,
  DateField,
  TimestampField,
} from '@malloydata/malloy';
import {VegaChart} from './vega/vega-chart';
import {RenderResultMetadata} from './types';
import {renderTimeString} from './render-time';
import {EventListenerHandler} from 'vega';
import {useStore} from './store-context';

export function Chart(props: {
  field: Explore | ExploreField;
  data: QueryData;
  metadata: RenderResultMetadata;
}) {
  const {field, data} = props;
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

  const [store, setStore] = useStore();
  const handleMouseOver: EventListenerHandler = (evt, item) => {
    console.log({evt, item});
    // const xField = field.allFields.at(0)!;
    // if (item) {
    //   setStore('interactions', interactions => {
    //     return [
    //       ...interactions,
    //       // {
    //       //   type: 'hover',
    //       //   field: xField.name,
    //       //   value: item.datum[xField.name],
    //       //   source: xField.fieldPath.join('.'),
    //       // },
    //     ];
    //   });
    // }
  };
  const onMouseOver = chartProps.onMouseOverWithStore
    ? chartProps.onMouseOverWithStore([store, setStore])
    : undefined;

  return (
    <VegaChart
      spec={spec}
      type={chartProps.specType}
      width={chartProps.plotWidth}
      height={chartProps.plotHeight}
      onMouseOver={onMouseOver}
    />
  );
}
