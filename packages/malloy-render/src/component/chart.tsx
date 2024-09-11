import {Explore, ExploreField, QueryData} from '@malloydata/malloy';
import {VegaChart} from './vega/vega-chart';
import {RenderResultMetadata} from './types';

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

  return (
    <VegaChart
      spec={spec}
      type={chartProps.specType}
      width={chartProps.plotWidth}
      height={chartProps.plotHeight}
    />
  );
}
