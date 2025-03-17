import type {JSXElement} from 'solid-js';
import {createEffect, createSignal, onCleanup, Show} from 'solid-js';
import tooltipCss from './tooltip.css?raw';
import {useConfig} from '../render';
import {MalloyModal} from '../malloy-modal/malloy-modal';

export function Tooltip(props: {show: boolean; children: JSXElement}) {
  const [pos, setPos] = createSignal<[number, number]>([0, 0]);
  const [xOffset, setXOffset] = createSignal(0);
  const [yOffset, setYOffset] = createSignal(0);

  const handler = evt => {
    if (props.show) {
      setPos([evt.clientX, evt.clientY]);
    }
  };
  document.addEventListener('mousemove', handler);

  onCleanup(() => {
    document.removeEventListener('mousemove', handler);
  });

  const config = useConfig();
  config.addCSSToShadowRoot(tooltipCss);

  let tip;

  createEffect(() => {
    if (pos() && tip) {
      let frame: number | null = null;
      frame = requestAnimationFrame(() => {
        if (frame) cancelAnimationFrame(frame);
        const threshold = 16;
        const rightBorder = pos()[0] + tip.clientWidth + threshold;
        const leftBorder = pos()[0];
        const topBorder = pos()[1];
        const bottomBorder = pos()[1] + tip.clientHeight + threshold;

        const overflowX = Math.min(0, globalThis.innerWidth - rightBorder);
        const overflowY = Math.min(0, globalThis.innerHeight - bottomBorder);

        // Don't allow overflow past left edge when re-positioning tooltip
        if (leftBorder - overflowX < 0) setXOffset(0);
        else setXOffset(overflowX);

        const isOverflowingY = overflowY < 0;
        // Check new position if moving to top
        const topPosition = topBorder - tip.clientHeight - threshold;
        // Don't allow overflow past top edge when re-positioning tooltip
        if (isOverflowingY && topPosition >= threshold)
          setYOffset(-tip.clientHeight - threshold);
        else setYOffset(0);
      });
    }
  });
  return (
    <Show when={props.show}>
      <MalloyModal
        ref={tip}
        style={`position: fixed; top: ${pos()[1] + yOffset()}px; left: ${
          pos()[0] + xOffset()
        }px; pointer-events: none; z-index: 1000`}
      >
        <div class="malloy-tooltip">{props.children}</div>
      </MalloyModal>
    </Show>
  );
}
