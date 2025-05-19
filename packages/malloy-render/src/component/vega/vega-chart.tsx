/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {createEffect, createSignal, untrack} from 'solid-js';
import type {EventListenerHandler, SignalListenerHandler, Runtime} from 'vega';
import {View} from 'vega';
import './vega-expr-addons';
import {addSignalListenerIfExists, setSignalIfExists} from './vega-utils';
import type {RepeatedRecordField} from '../../data_tree';

type VegaChartProps = {
  explore: RepeatedRecordField;
  width?: number;
  height?: number;
  onMouseOver?: EventListenerHandler;
  onView?: (view: View) => void;
  onViewInterface?: (viewInterface: ViewInterface) => void;
  runtime: Runtime;
};

export type ViewInterface = {
  view: View;
  setSignalAndRun: (name: string, value: unknown) => void;
  onSignal: (name: string, cb: SignalListenerHandler) => void;
};

export function VegaChart(props: VegaChartProps) {
  let el!: HTMLDivElement;

  const [view, setView] = createSignal<View | null>(null);

  let runViewTimeId: number | null = null;
  let lastAsyncRun: Promise<View | null> = Promise.resolve(null);
  const debouncedRunView = () => {
    if (runViewTimeId) cancelAnimationFrame(runViewTimeId);
    runViewTimeId = requestAnimationFrame(() => {
      const _view = view();
      if (_view) {
        lastAsyncRun = lastAsyncRun.then(v => {
          return v?.runAsync() || _view.runAsync();
        });
      }
    });
  };

  createEffect(() => {
    if (view()) {
      props.onViewInterface?.({
        view: view()!,
        setSignalAndRun: (name: string, value: unknown) => {
          setSignalIfExists(view()!, name, value);
          debouncedRunView();
        },
        onSignal: (name: string, cb: SignalListenerHandler) =>
          addSignalListenerIfExists(view()!, name, cb),
      });
    }
  });

  // Create new view on spec change
  createEffect(() => {
    const _view = untrack(() => view());
    if (_view) _view.finalize();

    const nextView = new View(props.runtime).initialize(el).renderer('svg');

    // This signal is needed before running the view for the first time
    setSignalIfExists(nextView, 'malloyExplore', props.explore);
    if (props.onMouseOver)
      nextView.addEventListener('mousemove', props.onMouseOver);
    nextView.run();
    setView(nextView);
    props.onView?.(nextView);
  });

  // Update size
  createEffect(() => {
    const _view = view();
    if (_view) {
      if (props.width) _view.width(props.width);
      if (props.height) _view.height(props.height);
      _view.run();
    }
  });

  return <div ref={el}></div>;
}
