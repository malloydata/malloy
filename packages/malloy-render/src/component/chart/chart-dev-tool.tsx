import {
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createSignal,
} from 'solid-js';
import type {ChartProps} from './chart';
import {Chart} from './chart';
import type {View} from 'vega';
import {parse} from 'vega';
import {createStore} from 'solid-js/store';
import {addSignalListenerIfExists} from '../vega/vega-utils';
import {useResultContext} from '../result-context';

type ChartDevToolProps = {
  onClose: () => void;
} & ChartProps;

function stripMalloyRecord(record: Record<string, unknown>) {
  const result = {};
  for (const [key, value] of Object.entries(record)) {
    if (key !== '__values' && key !== '__row') {
      if (value === null || typeof value !== 'object') {
        result[key] = value;
      } else if (Array.isArray(value)) {
        result[key] = value.map(stripMalloyRecord);
      } else {
        result[key] = stripMalloyRecord(value as Record<string, unknown>);
      }
    }
  }
  return result;
}

export default function ChartDevTool(props: ChartDevToolProps) {
  const metadata = useResultContext();
  const chartProps = metadata.vega[props.data.field.key].props;
  const [specString, setSpecString] = createSignal(
    JSON.stringify(chartProps.spec, null, 2)
  );

  const runtime = createMemo(() => {
    return parse(JSON.parse(specString()));
  });

  const [view, setView] = createSignal<View | undefined>();

  const [vegaSignals, setVegaSignals] = createStore<Record<string, unknown>>(
    {}
  );
  const [vegaData, setVegaData] = createStore<Record<string, unknown[]>>({});

  createEffect(() => {
    const _view = view();
    if (_view) {
      const state = _view.getState();

      const signals = state.signals ?? {};
      for (const [signalName, initValue] of Object.entries(signals)) {
        setVegaSignals(state => ({
          ...state,
          [signalName]: initValue,
        }));

        addSignalListenerIfExists(_view, signalName, (name, value) => {
          setVegaSignals(state => ({
            ...state,
            [name]: value,
          }));
        });
      }

      const runtimeData =
        (_view as unknown as {_runtime: {data: Record<string, unknown>}})
          ._runtime.data ?? {};

      for (const [dataName, initValue] of Object.entries(runtimeData)) {
        if (dataName === 'root') continue;
        let dataValues: Record<string, unknown>[] = [];
        const valueEntry = initValue?.['values']?.['value'];
        if (Array.isArray(valueEntry)) {
          dataValues = valueEntry.map(entry => {
            if (Object.prototype.hasOwnProperty.call(entry, 'datum'))
              return entry.datum;
            return entry;
          });
        } else {
          dataValues = valueEntry?.map(v => v.datum ?? {}) ?? [];
        }
        const clonedValues = structuredClone(dataValues.map(stripMalloyRecord));

        setVegaData(state => ({
          ...state,
          [dataName]: clonedValues,
        }));
      }
    }
  });

  const signalsList = () =>
    Object.entries(vegaSignals).filter(([key]) => key !== 'malloyExplore');
  const dataList = () => Object.entries(vegaData);
  const getDataRowValues = values => {
    return Object.entries(values).map(([key, value]) => {
      if (key === '__source') {
        const entry: Record<string, string> = Object.assign({}, value);
        delete entry['__malloyDataRecord'];
        return entry;
      }
      return value;
    });
  };

  const [tab, setTab] = createSignal<'signals' | 'data'>('signals');

  return (
    <div
      style={{
        'z-index': 1000,
        'height': '100vh',
        'width': '100vw',
        'position': 'fixed',
        'top': '0px',
        'left': '0px',
        'background': 'white',
      }}
    >
      <button onClick={props.onClose}>Close dev tool</button>
      <div
        style={{
          'display': 'grid',
          'grid-template-columns': 'minmax(0, 640px) 1fr',
          'height': '100%',
        }}
      >
        <div style="display: flex; flex-direction: column;">
          <textarea
            style={{
              'padding': '16px',
              'box-sizing': 'border-box',
              'flex-grow': 1,
            }}
            value={specString()}
            onChange={evt => setSpecString(evt.target.value)}
          />
          <div>
            <button
              onClick={() => {
                setSpecString(spec =>
                  JSON.stringify(JSON.parse(spec), null, 2)
                );
              }}
            >
              Format
            </button>
          </div>
        </div>
        <div
          style={{
            'padding': '16px',
            'background': '#eee',
            'height': '100%',
            'box-sizing': 'border-box',
            'display': 'grid',
            'grid-template-rows': 'max-content 1fr',
            'overflow': 'hidden',
          }}
        >
          <div style="background: white">
            <Show when={runtime()} keyed>
              {runtime => (
                <Chart {...props} runtime={runtime} onView={setView} />
              )}
            </Show>
          </div>
          <div
            style={{
              overflow: 'auto',
            }}
          >
            <div>
              <button onClick={() => setTab('signals')}>Show signals</button>
              <button onClick={() => setTab('data')}>Show data</button>
            </div>
            <Switch>
              <Match when={tab() === 'signals'}>
                <h3>Signals</h3>
                <table>
                  <thead>
                    <tr>
                      <th style="text-align: left">name</th>
                      <th style="text-align: left">value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={signalsList()}>
                      {([key, value]) => (
                        <tr>
                          <td>{key}</td>
                          <td>{JSON.stringify(value)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Match>
              <Match when={tab() === 'data'}>
                <h3>Data</h3>
                <For each={dataList()}>
                  {([dataName, values]) => (
                    <div>
                      <h4>
                        <u>{dataName}</u>
                      </h4>
                      <table>
                        <thead>
                          <tr>
                            <For each={Object.keys(values.at(0) ?? {})}>
                              {key => <th style="text-align: left">{key}</th>}
                            </For>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={values}>
                            {values => (
                              <tr>
                                <For each={getDataRowValues(values)}>
                                  {value => <td>{JSON.stringify(value)}</td>}
                                </For>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </div>
                  )}
                </For>
              </Match>
            </Switch>
          </div>
        </div>
      </div>
    </div>
  );
}
