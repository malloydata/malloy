import {For, Show} from 'solid-js';
import {ChartTooltipEntry} from '../types';
import {renderNumericField} from '../render-numeric-field';

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
          {({label, value, highlight, color}) => (
            <div
              class="malloy-tooltip--grid-row"
              classList={{
                'malloy-tooltip--entry-fade':
                  hasAttributes().highlight && !highlight,
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
              <div class="malloy-tooltip--entry-label">{label}</div>
              <div class="malloy-tooltip--entry-value">{String(value)}</div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
