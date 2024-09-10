import {Explore, ExploreField, QueryData} from '@malloydata/malloy';
import {VegaChart} from './vega/vega-chart';
import {RenderResultMetadata} from './types';
import {useConfig} from './render';

export function Chart(props: {
  field: Explore | ExploreField;
  data: QueryData;
  metadata: RenderResultMetadata;
}) {
  const {field, data} = props;
  const chartProps = props.metadata.field(field).vegaChartProps!;
  const vgSpec = structuredClone(chartProps.spec);
  vgSpec.data[0].values = data;
  return (
    <VegaChart
      spec={vgSpec}
      type="vega"
      width={chartProps.plotWidth}
      height={chartProps.plotHeight}
    />
  );
}
