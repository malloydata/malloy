import {Tag} from '@malloydata/malloy-tag';
import type {BigValueSettings} from './big-value-settings';
import {defaultBigValueSettings} from './big-value-settings';

export function bigValueSettingsToTag(settings: BigValueSettings): Tag {
  const tag = new Tag();

  // Add size if different from default
  if (settings.size && settings.size !== defaultBigValueSettings.size) {
    tag.set(['big_value', 'size'], settings.size);
  }

  // Add neutralThreshold if different from default
  if (
    settings.neutralThreshold !== undefined &&
    settings.neutralThreshold !== defaultBigValueSettings.neutralThreshold
  ) {
    tag.set(['big_value', 'neutral_threshold'], String(settings.neutralThreshold));
  }

  return tag;
}
