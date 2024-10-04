import {createSignal, JSXElement, onCleanup, onMount, Show} from 'solid-js';
import {Portal} from 'solid-js/web';
import tooltipCss from './tooltip.css?raw';

const TOOLTIP_STYLE_ID = 'malloy-tooltip-style';

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

  // Tooltips are rendered in the body outside of the malloy-render component,
  // so we need to append the styles to the head of the document, rather than scoped inside malloy-render.
  onMount(() => {
    if (!document.getElementById(TOOLTIP_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = TOOLTIP_STYLE_ID;
      style.textContent = tooltipCss;
      document.head.appendChild(style);
    }
  });

  return (
    <Show when={props.show}>
      <Portal>
        <div
          style={`position: fixed; top: ${pos()[1]}px; left: ${
            pos()[0]
          }px; width: 0px; height: 0px; pointer-events: none;`}
        >
          <div class="malloy-tooltip">{props.children}</div>
        </div>
      </Portal>
    </Show>
  );
}
