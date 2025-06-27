import type {Tag} from '@malloydata/malloy-tag';
import type {NestField} from '@/data_tree';
import {Field} from '@/data_tree';
import {convertLegacyToVizTag} from '@/component/tag-utils';
import {type WaterfallChartSettings} from './waterfall-chart-settings';

function getFieldPath(explore: NestField, ref: string): string {
  let path: string[];
  try {
    path = Field.pathFromString(ref);
  } catch {
    path = [ref];
  }
  const field = explore.fieldAt(path);
  return explore.pathTo(field);
}

export function getWaterfallChartSettings(
  explore: NestField,
  tagOverride?: Tag
): WaterfallChartSettings {
  const normalizedTag = convertLegacyToVizTag(tagOverride ?? explore.tag);
  if (normalizedTag.text('viz') !== 'waterfall') {
    throw new Error(
      'Malloy Waterfall Chart: Tried to render a waterfall chart, but no viz=waterfall tag was found'
    );
  }

  const vizTag = normalizedTag.tag('viz')!;

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
    startField: getFieldPath(explore, startRef),
    endField: getFieldPath(explore, endRef),
    xField: getFieldPath(explore, xRef),
    yField: getFieldPath(explore, yRef),
  };
}

export type {WaterfallChartSettings};
