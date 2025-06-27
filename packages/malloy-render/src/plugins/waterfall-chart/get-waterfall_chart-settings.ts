import type {Tag} from '@malloydata/malloy-tag';
import type {NestField} from '@/data_tree';
import {type WaterfallChartSettings} from './waterfall-chart-settings';

export function getWaterfallChartSettings(
  explore: NestField,
  tagOverride?: Tag
): WaterfallChartSettings {
  const tag = tagOverride ?? explore.tag;
  const vizTag = tag.tag('viz')!;

  const startRef = vizTag.text('start');
  const endRef = vizTag.text('end');
  const xRef = vizTag.text('x');
  const yRef = vizTag.text('y');

  if (!startRef || !endRef || !xRef || !yRef) {
    throw new Error(
      'Malloy Waterfall Chart: start, end, x and y must be specified'
    );
  }

  return {
    startField: JSON.stringify(startRef.split('.')),
    endField: JSON.stringify(endRef.split('.')),
    xField: JSON.stringify(xRef.split('.')),
    yField: JSON.stringify(yRef.split('.')),
  };
}

export type {WaterfallChartSettings};
