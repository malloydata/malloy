/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Item, SignalListenerHandler, View} from 'vega';

function viewHasSignal(view: View, signal: string) {
  const viewSignals = view.getState().signals;
  return (
    viewSignals && Object.prototype.hasOwnProperty.call(viewSignals, signal)
  );
}

export function addSignalListenerIfExists(
  view: View,
  signal: string,
  cb: SignalListenerHandler
) {
  if (viewHasSignal(view, signal)) view.addSignalListener(signal, cb);
}

export function setSignalIfExists(view: View, signal: string, value: unknown) {
  if (viewHasSignal(view, signal)) view.signal(signal, value);
}

export function getMarkName(item: Item): string {
  // RunTimeMark type is missing the 'name' property
  return (item.mark as unknown as Item & {name: string | undefined}).name ?? '';
}

// Dev tool for logging signals for a view
export function signalLogger(view: View, id = '') {
  return (...signals: string[]) => {
    signals.forEach(signal => {
      addSignalListenerIfExists(view, signal, (...args) =>
        // eslint-disable-next-line no-console
        console.log(id, ...args)
      );
    });
  };
}
