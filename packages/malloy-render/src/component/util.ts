/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import {type Accessor, createSignal, onMount, type Setter} from 'solid-js';

export function getTextWidthCanvas(
  text: string,
  font: string,
  canvasToUse?: HTMLCanvasElement
) {
  const canvas = canvasToUse ?? document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  context.font = font;
  const metrics = context.measureText(text);
  return metrics.width;
}

export function getTextWidthDOM(text: string, styles: Record<string, string>) {
  const measureDiv = document.createElement('div');
  measureDiv.innerHTML = text;
  for (const [key, value] of Object.entries(styles)) {
    measureDiv.style[key] = value;
  }
  document.body.appendChild(measureDiv);
  const rect = measureDiv.getBoundingClientRect();
  document.body.removeChild(measureDiv);
  return rect.width;
}

export function getTextHeightDOM(text: string, styles: Record<string, string>) {
  const measureDiv = document.createElement('div');
  measureDiv.innerHTML = text;
  for (const [key, value] of Object.entries(styles)) {
    measureDiv.style[key] = value;
  }
  document.body.appendChild(measureDiv);
  const rect = measureDiv.getBoundingClientRect();
  document.body.removeChild(measureDiv);
  return rect.height;
}

export function clamp(s: number, e: number, v: number) {
  return Math.max(s, Math.min(e, v));
}

export function getRangeSize(range: [number, number]) {
  return range[1] - range[0] + 1;
}

function rafCallback<T extends (...args: unknown[]) => void>(fn: T) {
  let rafId: number | null = null;
  return function (this: unknown, ...args: Parameters<T>) {
    if (rafId) cancelAnimationFrame(rafId);

    rafId = requestAnimationFrame(() => {
      fn.apply(this, args);
    });
  };
}

export function createRAFSignal<T>(initialValue: T) {
  const [signal, setSignal] = createSignal<T>(initialValue);
  const setRAFSignal = rafCallback(setSignal);
  return [signal, setRAFSignal] as const;
}

export type ResizeDirectiveValue = [
  Accessor<{width: number; height: number}>,
  Setter<{width: number; height: number}>,
];

export function resize(
  el: HTMLElement,
  value: Accessor<ResizeDirectiveValue>
): void {
  onMount(() => {
    const [parentSize, setParentSize] = value();
    const setParentSizeRAF = rafCallback(setParentSize);

    const o = new ResizeObserver(entries => {
      const {width, height} = entries[0].contentRect;
      if (width !== parentSize().width || height !== parentSize().height) {
        setParentSizeRAF({
          width,
          height,
        });
      }
    });

    o.observe(el);
    return () => o.disconnect();
  });
}
