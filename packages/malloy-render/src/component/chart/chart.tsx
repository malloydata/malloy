/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {ViewInterface} from '../vega/vega-chart';
import {VegaChart} from '../vega/vega-chart';
import type {ChartTooltipEntry} from '../types';
import {Tooltip} from '../tooltip/tooltip';
import {createEffect, createSignal, createMemo, Show} from 'solid-js';
import {DefaultChartTooltip} from './default-chart-tooltip';
import type {EventListenerHandler, Runtime, View} from 'vega';
import type {VegaBrushOutput} from '../result-store/result-store';
import css from './chart.css?raw';
import {useConfig} from '../render';
import {DebugIcon} from './debug_icon';
import ChartDevTool from './chart-dev-tool';
import type {RepeatedRecordCell} from '../../data_tree';
import {useResultContext} from '../result-context';

let IS_STORYBOOK = false;
try {
  const storybookConfig = (process.env as Record<string, string>)[
    'IS_STORYBOOK'
  ];
  if (typeof storybookConfig !== 'undefined')
    IS_STORYBOOK = Boolean(storybookConfig);
} catch (e) {
  // Continue with storybook flag off
}

export type ChartProps = {
  data: RepeatedRecordCell;
  // Debugging properties
  devMode?: boolean;
  runtime?: Runtime;
  onView?: (view: View) => void;
};

export function Chart(props: ChartProps) {
  const config = useConfig();
  const metadata = useResultContext();
  config.addCSSToShadowRoot(css);
  const data = props.data;
  const field = data.field;
  const vegaInfo = metadata.vega[field.key];
  const {runtime, props: chartProps} = vegaInfo;
  if (!runtime)
    throw new Error('Charts must have a runtime defined in their metadata');
  let values: unknown[] = [];
  // New vega charts use mapMalloyDataToChartData handlers
  if (chartProps.mapMalloyDataToChartData) {
    values = chartProps.mapMalloyDataToChartData(data);
  }

  const [viewInterface, setViewInterface] = createSignal<ViewInterface | null>(
    null
  );
  const view = () => viewInterface()?.view;

  createEffect(() => {
    const _view = view();

    if (_view) {
      _view.data('values', values);
      _view.runAsync();
      props.onView?.(_view);
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
            metadata.store.applyBrushOps([
              {type: 'remove', sourceId: brush.sourceId},
            ]);
          }, debounceTime)
        );
      } else
        metadata.store.applyBrushOps([
          {type: 'remove', sourceId: brush.sourceId},
        ]);
    } else if (shouldDebounce && debounceStrategy === 'always')
      timeouts.set(
        brush.sourceId,
        setTimeout(() => {
          metadata.store.applyBrushOps([
            {type: 'add', sourceId: brush.sourceId, value: brush.data!},
          ]);
        }, debounceTime)
      );
    else
      metadata.store.applyBrushOps([
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
    const fieldRefIds = field.fields.map(f =>
      f.isAtomic() ? f.referenceId : null
    );
    const relevantBrushes = metadata.store.store.brushes.filter(brush =>
      fieldRefIds.includes(brush.fieldRefId)
    );

    viewInterface()?.setSignalAndRun(
      'brushIn',
      // TODO this is kindof a hack to make sure we react to any changes in the brush array, since our proxy updates won't react if we just listen on the field ref ids and one of them is updated.
      // Is there a better way in Solid stores to react to "any sub-property of this object changes"?
      JSON.parse(JSON.stringify(relevantBrushes))
    );
  });

  const [showDebugModal, setShowDebugModal] = createSignal(false);
  const openDebug = () => {
    setTooltipData(null);
    setShowDebugModal(true);
  };

  const showTooltip = createMemo(() => Boolean(tooltipData()));

  const chartTitle = chartProps.chartTag.text('title');
  const chartSubtitle = chartProps.chartTag.text('subtitle');
  const hasTitleBar = chartTitle || chartSubtitle;

  return (
    <div
      class="malloy-chart"
      onMouseLeave={() => {
        // immediately clear tooltips and highlights on leaving chart
        setTooltipData(null);
        metadata.store.applyBrushOps(
          brushOuts
            .filter(brush => brush.data?.type !== 'measure-range')
            .map(brush => ({type: 'remove', sourceId: brush.sourceId}))
        );
      }}
    >
      <Show when={hasTitleBar}>
        <div class="malloy-chart__titles-bar">
          {chartTitle && <div class="malloy-chart__title">{chartTitle}</div>}
          {chartSubtitle && (
            <div class="malloy-chart__subtitle">{chartSubtitle}</div>
          )}
        </div>
      </Show>
      <VegaChart
        width={chartProps.plotWidth}
        height={chartProps.plotHeight}
        onMouseOver={mouseOverHandler}
        onViewInterface={setViewInterface}
        explore={field}
        runtime={runtime}
      />
      <Tooltip show={showTooltip()}>
        <DefaultChartTooltip data={tooltipData()!} />
      </Tooltip>
      <Show when={IS_STORYBOOK && !props.devMode}>
        <button class="malloy-chart_debug_menu" onClick={openDebug}>
          <DebugIcon />
        </button>
        <Show when={showDebugModal()}>
          <ChartDevTool
            onClose={() => setShowDebugModal(false)}
            {...props}
            devMode={true}
          />
        </Show>
      </Show>
    </div>
  );
}
