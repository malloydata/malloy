/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

// Legacy exports for backward compatibility
export {HTMLView, JSONView} from './html/html_view';
export * from './html/data_styles';
export type {MalloyRenderProps} from './component/render';

// New JavaScript API exports
export {MalloyRenderer} from '@/api/malloy-renderer';
export type {MalloyViz} from '@/api/malloy-viz';
export type {
  CoreVizPluginInstance,
  RenderPluginInstance,
} from '@/api/plugin-types';
export {isCoreVizPluginInstance} from '@/api/plugin-types';
export type {
  MalloyExplicitTheme,
  MalloyRendererOptions,
  RenderFieldMetadata,
} from '@/api/types';
export type * from '@/api/json-schema-types';
export type {
  DrillData,
  MalloyClickEventPayload,
  TableConfig,
  DashboardConfig,
  VegaConfigHandler,
} from '@/component/types';
export * from '@/plugins';
