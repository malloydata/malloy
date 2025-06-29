import {Tag} from '@malloydata/malloy-tag';
import type {WaterfallChartSettings} from './waterfall-chart-settings';

export function waterfallChartSettingsToTag(
  settings: WaterfallChartSettings
): Tag {
  let tag = new Tag({properties: {viz: {eq: 'waterfall'}}});
  if (settings.startField) tag = tag.set(['viz', 'start'], settings.startField);
  if (settings.endField) tag = tag.set(['viz', 'end'], settings.endField);
  if (settings.xField) tag = tag.set(['viz', 'x'], settings.xField);
  if (settings.yField) tag = tag.set(['viz', 'y'], settings.yField);
  return tag;
}
