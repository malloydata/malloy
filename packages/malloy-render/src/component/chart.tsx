import {Explore, ExploreField, QueryData} from '@malloydata/malloy';
import {VegaChart} from './vega/vega-chart';
import {RenderResultMetadata} from './types';
import {renderTimeString} from './render-time';

export function Chart(props: {
  field: Explore | ExploreField;
  data: QueryData;
  metadata: RenderResultMetadata;
}) {
  const {field, data} = props;
  const chartProps = props.metadata.field(field).vegaChartProps!;
  const spec = structuredClone(chartProps.spec);
  if (chartProps.specType === 'vega') {
    spec.data[0].values = data;
  } else spec.data.values = data;

  // TODO: improve handling date/times in chart axes
  const dateTimeFields = field.allFields.filter(
    f => f.isAtomicField() && (f.isDate() || f.isTimestamp())
  );
  data.forEach(row => {
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

  return (
    <VegaChart
      spec={spec}
      type={chartProps.specType}
      width={chartProps.plotWidth}
      height={chartProps.plotHeight}
    />
  );
}
