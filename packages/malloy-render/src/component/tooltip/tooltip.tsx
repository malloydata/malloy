import {
  createEffect,
  createSignal,
  JSXElement,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import {Portal} from 'solid-js/web';
import './tooltip.css';
import {
  autoUpdate,
  computePosition,
  detectOverflow,
  offset,
  shift,
} from '@floating-ui/dom';

export function Tooltip(props: {show: boolean; children: JSXElement}) {
  let anchor;
  let tooltip;
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

  const [tooltipPos, setTooltipPos] = createSignal([0, 0]);

  const middleware = {
    name: 'middleware',
    async fn(state) {
      const overflow = await detectOverflow(state, {
        boundary: document.body,
      });
      console.log({overflow});
      return {};
    },
  };

  createEffect(() => {
    let cleanup;
    if (props.show) {
      cleanup = autoUpdate(anchor, tooltip, () =>
        computePosition(anchor, tooltip, {
          placement: 'right-start',
          middleware: [
            // offset({
            //   mainAxis: 10,
            //   crossAxis: 10,
            // }),
            // shift(),
            middleware,
          ],
        }).then(({x, y}) => {
          // console.log({x, y, d: Date.now()});
          setTooltipPos([x, y]);
        })
      );
    }
    return () => {
      if (cleanup) cleanup();
    };
  });

  return (
    <Portal>
      <Show when={props.show}>
        <div
          ref={anchor}
          style={`position: fixed; top: ${pos()[1]}px; left: ${
            pos()[0]
          }px; width: 0px; height: 0px; pointer-events: none;`}
        >
          <div
            ref={tooltip}
            class="malloy-tooltip"
            style={{
              left: `${tooltipPos()[0]}px`,
              top: `${tooltipPos()[1]}px`,
            }}
          >
            {props.children}
          </div>
        </div>
      </Show>
    </Portal>
  );
}
