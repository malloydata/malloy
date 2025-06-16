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
import type {EventListenerHandler, Item, Runtime, View} from 'vega';
import type {VegaBrushOutput} from '../result-store/result-store';

import {DebugIcon} from './debug_icon';
// import ChartDevTool from './chart-dev-tool';
import type {RepeatedRecordCell} from '../../data_tree';
import {useResultContext} from '../result-context';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {createRAFSignal, resize} from '../util';
import {MalloyViz} from '@/api/malloy-viz';
import styles from './chart.css?raw';

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

export type ChartV2Props = {
  data: RepeatedRecordCell;
  values: unknown[];
  runtime: Runtime;
  vegaSpec: unknown;
  plotWidth: number;
  plotHeight: number;
  getTooltipData?: (item: Item, view: View) => ChartTooltipEntry | null;
  // Debugging properties
  devMode?: boolean;
  onView?: (view: View) => void;
};

export function ChartV2(props: ChartV2Props) {
  MalloyViz.addStylesheet(styles);
  return <ChartV2Inner {...props} />;
}

export function ChartV2Inner(props: ChartV2Props) {
  const metadata = useResultContext();

  const [viewInterface, setViewInterface] = createSignal<ViewInterface | null>(
    null
  );
  const view = () => viewInterface()?.view;

  createEffect(() => {
    const _view = view();
    if (_view) {
      _view.data('values', props.values);
      _view.runAsync();
      props.onView?.(_view);
    }
  });

  // Tooltip data
  const [tooltipData, setTooltipData] =
    createRAFSignal<null | ChartTooltipEntry>(null);

  // Debounce while moving within chart
  const mouseOverHandler: EventListenerHandler = (event, item) => {
    if (view() && item && props.getTooltipData) {
      const data = props.getTooltipData(item, view()!);
      setTooltipData(data);
    } else setTooltipData(null);
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

  // Pass relevant brushes from store into the vega view
  createEffect(() => {
    const fieldRefIds = props.data.field.fields.map(f =>
      f.isBasic() ? f.referenceId : null
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

  const [showDebugModal, setShowDebugModal] = createSignal(false);
  const openDebug = () => {
    setTooltipData(null);
    setShowDebugModal(true);
  };

  const showTooltip = createMemo(() => Boolean(tooltipData()));

  const [chartSpace, setChartSpace] = createSignal({
    width: props.plotWidth,
    height: props.plotHeight,
  });

  return (
    <div
      class="malloy-chart"
      style={{
        width: props.plotWidth + 'px',
        height: props.plotHeight + 'px',
      }}
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
      <div
        class="malloy-chart__container"
        use:resize={[chartSpace, setChartSpace]}
      >
        <VegaChart
          explore={props.data.field}
          width={chartSpace().width}
          height={chartSpace().height}
          onMouseOver={mouseOverHandler}
          onViewInterface={setViewInterface}
          runtime={props.runtime}
        />
      </div>
      <Tooltip show={showTooltip()}>
        <DefaultChartTooltip data={tooltipData()!} />
      </Tooltip>
      <Show when={IS_STORYBOOK && !props.devMode}>
        <button class="malloy-chart_debug_menu" onClick={openDebug}>
          <DebugIcon />
        </button>
        {/* TODO fix debug modal */}
        <Show when={showDebugModal()}>
          {null}
          {/* <ChartDevTool
            onClose={() => setShowDebugModal(false)}
            runtime={props.runtime}
            {...props}
            chartProps={props.vegaSpec.chartProps}
            devMode={true}
          /> */}
        </Show>
      </Show>
    </div>
  );
}
