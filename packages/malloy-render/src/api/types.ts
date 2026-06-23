/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  DashboardConfig,
  DrillData,
  MalloyClickEventPayload,
  TableConfig,
  VegaConfigHandler,
} from '@/component/types';
import type {RenderPluginFactory} from './plugin-types';

export type {RenderFieldMetadata} from '@/render-field-metadata';

/**
 * Explicit theme overrides applied by the embedder.
 *
 * @experimental Provisional surface, not the finished theming feature.
 * The property set here is deliberately narrow (mostly table and font
 * chrome) and will be superseded by a designed theme that also covers the
 * categorical chart palette, typography by role, and continuous color
 * schemes. Expect this interface to change; pin a renderer version if you
 * depend on its current shape.
 *
 * Resolution order (highest wins): explicit theme key here, then
 * `# theme.<key>` on the result, then `## theme.<key>` on the model,
 * then the CSS fallback `var(--malloy-theme--<kebab>)`. Every key is
 * optional; omitted keys fall through the chain. An empty string is
 * treated the same as `undefined` so a cleared input drops back to
 * the next layer.
 *
 * This full resolution chain applies to the CSS-variable chrome keys
 * (the table and font keys, plus `background`), which are emitted as
 * `--malloy-render--*` variables and must be valid CSS values (e.g.
 * `"#ff0000"`, `"1px solid #ccc"`, `"14px"`). The `mapColor` key and
 * the map canvas `background` are consumed inside the Vega spec rather
 * than via CSS and are read only from this embedder prop; `# theme`
 * and `## theme` annotations and the CSS fallback do not reach the map
 * canvas. See the `mapColor` field doc.
 *
 * Note: this theme is only read by the modern `MalloyRenderer` /
 * `MalloyViz` API. The legacy `HTMLView` / `JSONView` exports do not
 * consult it.
 *
 * Note: because the embedder layer is the highest precedence, a model
 * publisher cannot override an embedder-supplied value with a
 * `# theme.*` annotation. If you need the model to win for a specific
 * key, omit that key from the embedder theme.
 */
export interface MalloyExplicitTheme {
  tableRowHeight?: string;
  tableBodyColor?: string;
  tableFontSize?: string;
  tableHeaderColor?: string;
  tableHeaderWeight?: string;
  tableBodyWeight?: string;
  tableBorder?: string;
  tableBackground?: string;
  tableGutterSize?: string;
  tablePinnedBackground?: string;
  tablePinnedBorder?: string;
  fontFamily?: string;
  background?: string;
  /**
   * @experimental Provisional, and the last bespoke color knob of this
   * kind. `mapColor` is the one property that crosses from chrome into
   * chart-data color; it is kept as a one-off to unblock current embedders.
   * Further color or theme surface will arrive through the designed theme,
   * not as additional standalone properties like this one.
   *
   * Saturated end of the gradient used by sequential color scales on
   * `# shape_map` and `# segment_map` choropleth visualizations.
   *
   * Unlike the other keys on this interface, `mapColor` is consumed
   * programmatically by `getColorScale` and baked into the Vega scale
   * range at render time. It is NOT emitted as a `--malloy-render--*`
   * CSS variable, so `var()` references won't resolve. Pass a literal
   * colour string (e.g. `"#ff0000"`).
   *
   * The renderer derives the low end of the gradient automatically
   * (light neutral for dark/medium high-ends, dark neutral for light
   * high-ends) so the operator only has to pick the brand-saturated
   * colour. When unset, the renderer uses its built-in blue gradient.
   *
   * Rect-mark heatmaps and the legacy `HTMLView` chart paths keep
   * their existing palettes and ignore this key.
   */
  mapColor?: string;
}

export interface MalloyRendererOptions {
  onClick?: (payload: MalloyClickEventPayload) => void;
  onDrill?: (drillData: DrillData) => void;
  vegaConfigOverride?: VegaConfigHandler;
  tableConfig?: Partial<TableConfig>;
  dashboardConfig?: Partial<DashboardConfig>;
  modalElement?: HTMLElement;
  scrollEl?: HTMLElement;
  onError?: (error: Error) => void;
  plugins?: RenderPluginFactory[];
  pluginOptions?: Record<string, unknown>;
  useVegaInterpreter?: boolean;
  /**
   * Optional explicit theme overrides. Keys here take precedence over
   * any `# theme.*` annotations on the result and over the renderer's
   * own CSS variable defaults. See {@link MalloyExplicitTheme}.
   *
   * @experimental Provisional surface, the shape may change. This is not
   * yet the finished theming feature; see {@link MalloyExplicitTheme} for
   * the current property set and that caveat.
   */
  theme?: MalloyExplicitTheme;
}
