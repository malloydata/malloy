/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {Explore, ExploreField, QueryData} from '@malloydata/malloy';
import {VegaChart, ViewInterface} from '../vega/vega-chart';
import {ChartTooltipEntry, RenderResultMetadata} from '../types';
import {Tooltip} from '../tooltip/tooltip';
import {createEffect, createSignal} from 'solid-js';
import {DefaultChartTooltip} from './default-chart-tooltip';
import {EventListenerHandler} from 'vega';
import {useResultStore, VegaBrushOutput} from '../result-store/result-store';

export function Chart(props: {
  field: Explore | ExploreField;
  data: QueryData;
  metadata: RenderResultMetadata;
}) {
  const {field, data} = props;
  const chartProps = props.metadata.field(field).vegaChartProps!;
  const runtime = props.metadata.field(field).runtime;
  if (!runtime)
    throw new Error('Charts must have a runtime defined in their metadata');
  const chartData = data;
  for (let i = 0; i < chartData.length; i++) {
    chartData[i]['__malloyDataRecord'] = data[i]['__malloyDataRecord'];
  }
  let values: unknown[] = [];
  // New vega charts use mapMalloyDataToChartData handlers
  if (chartProps.mapMalloyDataToChartData) {
    values = chartProps.mapMalloyDataToChartData(field, chartData);
  }

  // TODO: improve handling date/times in chart axe

  const [viewInterface, setViewInterface] = createSignal<ViewInterface | null>(
    null
  );
  const view = () => viewInterface()?.view;

  createEffect(() => {
    const _view = view();

    if (_view) {
      _view.data('values', values);
      _view.runAsync();
    }
  });

  // Tooltip data
  const [tooltipData, setTooltipData] = createSignal<null | ChartTooltipEntry>(
    null
  );
  let tId: NodeJS.Timeout | null = null;
  const setTooltipDataDebounce = (data: ChartTooltipEntry | null) => {
    if (tId) clearTimeout(tId);
    if (data !== null) setTooltipData(data);
    else tId = setTimeout(() => setTooltipData(null), 0);
  };
  // Debounce while moving within chart
  const mouseOverHandler: EventListenerHandler = (event, item) => {
    if (view() && item && chartProps.getTooltipData) {
      const data = chartProps.getTooltipData(item, view()!);
      setTooltipDataDebounce(data);
    } else setTooltipDataDebounce(null);
  };

  const resultStore = useResultStore();

  // Enable charts to debounce interactions; this helps with rapid mouse movement through charts
  const timeouts = new Map();
  const debouncedApplyBrush = (brush: VegaBrushOutput) => {
    const shouldDebounce = Object.prototype.hasOwnProperty.call(
      brush,
      'debounce'
    );
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

    const isEmptyBrush = !brush.data;

    if (isEmptyBrush) {
      if (shouldDebounce) {
        // empty gets debounced in either strategy
        timeouts.set(
          brush.sourceId,
          setTimeout(() => {
            resultStore.applyBrushOps([
              {type: 'remove', sourceId: brush.sourceId},
            ]);
          }, debounceTime)
        );
      } else
        resultStore.applyBrushOps([{type: 'remove', sourceId: brush.sourceId}]);
    } else if (shouldDebounce && debounceStrategy === 'always')
      timeouts.set(
        brush.sourceId,
        setTimeout(() => {
          resultStore.applyBrushOps([
            {type: 'add', sourceId: brush.sourceId, value: brush.data!},
          ]);
        }, debounceTime)
      );
    else
      resultStore.applyBrushOps([
        {type: 'add', sourceId: brush.sourceId, value: brush.data!},
      ]);
  };

  // read brushes out from the vega view and add to the store
  let brushOuts: VegaBrushOutput[] = [];
  createEffect(() => {
    viewInterface()?.onSignal(
      'brushOut',
      (name, brushes: VegaBrushOutput[]) => {
        brushOuts = brushes;
        brushes.forEach(brush => {
          debouncedApplyBrush(brush);
        });
      }
    );
  });

  // Pass relevant brushes from store into the vega view
  createEffect(() => {
    const fieldRefIds = props.field.allFields.map(f =>
      f.isAtomicField() ? f.referenceId : null
    );
    const relevantBrushes = resultStore.store.brushes.filter(brush =>
      fieldRefIds.includes(brush.fieldRefId)
    );

    viewInterface()?.setSignalAndRun(
      'brushIn',
      // TODO this is kindof a hack to make sure we react to any changes in the brush array, since our proxy updates won't react if we just listen on the field ref ids and one of them is updated.
      // Is there a better way in Solid stores to react to "any sub-property of this object changes"?
      JSON.parse(JSON.stringify(relevantBrushes))
    );
  });

  return (
    <div
      onMouseLeave={() => {
        // immediately clear tooltips and highlights on leaving chart
        setTooltipData(null);
        resultStore.applyBrushOps(
          brushOuts
            .filter(brush => brush.data?.type !== 'measure-range')
            .map(brush => ({type: 'remove', sourceId: brush.sourceId}))
        );
      }}
      style="width: fit-content; height: fit-content; font-variant-numeric: tabular-nums;"
    >
      <VegaChart
        width={chartProps.plotWidth}
        height={chartProps.plotHeight}
        onMouseOver={mouseOverHandler}
        onViewInterface={setViewInterface}
        explore={props.field}
        runtime={runtime}
      />
      <Tooltip show={!!tooltipData()}>
        <DefaultChartTooltip data={tooltipData()!} />
      </Tooltip>
    </div>
  );
}
