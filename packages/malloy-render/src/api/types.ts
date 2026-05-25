/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
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
 * Explicit theme overrides that win over Malloy `# theme.*` annotations
 * AND over the renderer's CSS variable defaults. Every key is optional;
 * any key that is omitted falls through the existing resolution chain
 * (local annotation → model annotation → `var(--malloy-theme--*)`
 * default). Values are inserted directly into the inline style block
 * that drives the renderer's `--malloy-render--*` variables, so they
 * must be valid CSS values (e.g. `"#ff0000"`, `"1px solid #ccc"`,
 * `"14px"`).
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
   * Saturated end of the gradient used by sequential color scales
   * (choropleth maps, heatmaps, area charts). The renderer pairs this
   * with a near-neutral low-end (`#f5f5f5`) so the operator only has
   * to pick the brand-saturated colour. When unset, the renderer
   * falls back to its built-in blue gradient.
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
   */
  theme?: MalloyExplicitTheme;
}
