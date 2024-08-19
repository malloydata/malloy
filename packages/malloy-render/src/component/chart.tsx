import {Explore, ExploreField, QueryData} from '@malloydata/malloy';
import {VegaChart} from './vega/vega-chart';
import {RenderResultMetadata} from './types';
import cloneDeep from 'lodash/cloneDeep';

export function Chart(props: {
  field: Explore | ExploreField;
  data: QueryData;
  metadata: RenderResultMetadata;
}) {
  const {field, data} = props;
  const chartProps = props.metadata.field(field).vegaChartProps!;
  const vgSpec = cloneDeep(chartProps.spec);
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
