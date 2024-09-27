import {For} from 'solid-js';
import {ChartTooltipEntry} from '../types';
import {renderNumericField} from '../render-numeric-field';

export function DefaultChartTooltip(props: {data: ChartTooltipEntry[]}) {
  return (
    <table class="malloy-tooltip--table">
      <tbody>
        <For each={props.data}>
          {({field, fieldName, value}) => (
            <tr>
              <th>{fieldName}</th>
              <td>
                {typeof value === 'number' && field.isAtomicField()
                  ? renderNumericField(field, value)
                  : String(value)}
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}
