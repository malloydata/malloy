import type {RendererValidationSpec} from '@/api/plugin-types';

// Built-in renderers use the same semantic ownership model as plugins.
// Keep this registry narrowly focused on tags whose meaning depends on
// the active renderer, not globally meaningful field tags.
const BUILT_IN_RENDERER_VALIDATION_SPECS: Record<
  string,
  RendererValidationSpec
> = {
  dashboard: {
    renderer: 'dashboard',
    // No childOwnedPaths needed: resolveBuiltInTags reads span/subtitle/
    // break/borderless on every dashboard child at setup time, which marks
    // them read so the unread-tag detector never warns. Declaring them here
    // too would be redundant.
    childOwnedPaths: [],
  },
};

export function getBuiltInRendererValidationSpec(
  renderAs: string
): RendererValidationSpec | undefined {
  return BUILT_IN_RENDERER_VALIDATION_SPECS[renderAs];
}
