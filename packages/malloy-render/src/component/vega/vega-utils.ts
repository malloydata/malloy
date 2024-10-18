import {SignalListenerHandler, View} from 'vega';

export function addSignalListenerIfExists(
  view: View,
  signal: string,
  cb: SignalListenerHandler
) {
  if (view.getState().signals?.hasOwnProperty(signal))
    view.addSignalListener(signal, cb);
}

export function setSignalIfExists(view: View, signal: string, value: unknown) {
  if (view.getState().signals?.hasOwnProperty(signal))
    view.signal(signal, value);
}
