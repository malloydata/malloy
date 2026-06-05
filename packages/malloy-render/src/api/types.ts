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
}
