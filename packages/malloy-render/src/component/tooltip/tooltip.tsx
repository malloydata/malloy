import {createSignal, JSXElement, onCleanup, Show} from 'solid-js';
import {Portal} from 'solid-js/web';
import './tooltip.css';

export function Tooltip(props: {show: boolean; children: JSXElement}) {
  const [pos, setPos] = createSignal([0, 0]);
  const handler = evt => {
    if (props.show) {
      setPos([evt.clientX, evt.clientY]);
    }
  };
  document.addEventListener('mousemove', handler);

  onCleanup(() => {
    document.removeEventListener('mousemove', handler);
  });

  return (
    <Portal>
      <Show when={props.show}>
        <div
          style={`position: fixed; top: ${pos()[1]}px; left: ${
            pos()[0]
          }px; width: 0px; height: 0px; pointer-events: none;`}
        >
          <div class="malloy-tooltip">{props.children}</div>
        </div>
      </Show>
    </Portal>
  );
}
