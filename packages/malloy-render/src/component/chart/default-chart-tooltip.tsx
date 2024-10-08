import {For, Match, Show, Switch} from 'solid-js';
import {ChartTooltipEntry} from '../types';
import {renderNumericField} from '../render-numeric-field';
import {useResultContext} from '../result-context';

export function DefaultChartTooltip(props: {data: ChartTooltipEntry}) {
  const hasAttributes = () =>
    props.data.entries.reduce(
      (acc, curr) => ({
        highlight: acc.highlight || curr.highlight,
        color: acc.color || Boolean(curr.color),
      }),
      {highlight: false, color: false}
    );

  return (
    <div>
      <div class="malloy-tooltip--header">
        <For each={props.data.title}>
          {title => <div class="malloy-tooltip--title">{title}</div>}
        </For>
      </div>
      <div class="malloy-tooltip--grid">
        <For each={props.data.entries}>
          {({
            label,
            value,
            highlight,
            color,
            ignoreHighlightState = false,
            entryType,
          }) => (
            <div
              class="malloy-tooltip--grid-row"
              classList={{
                'malloy-tooltip--entry-fade':
                  hasAttributes().highlight &&
                  !highlight &&
                  !ignoreHighlightState,
              }}
            >
              <Show when={hasAttributes().color}>
                <div class="malloy-tooltip--entry-color">
                  <div
                    class="malloy-tooltip--color-circle"
                    style={{background: color}}
                  ></div>
                </div>
              </Show>
              <Switch>
                <Match when={entryType === 'list-item'}>
                  <div class="malloy-tooltip--list-item-row">
                    <div class="malloy-tooltip--entry-label">{label}</div>
                    <div class="malloy-tooltip--entry-value">
                      {typeof value === 'function' ? value() : value}
                    </div>
                  </div>
                </Match>
                <Match when={entryType === 'block'}>
                  <div class="malloy-tooltip--block-row">
                    <div class="malloy-tooltip--block-label">{label}</div>
                    <div class="malloy-tooltip--block-value">
                      {typeof value === 'function' ? value() : value}
                    </div>
                  </div>
                </Match>
              </Switch>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
