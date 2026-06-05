/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {MalloyRenderProps} from '../component/render';
import type {DataStyles} from './data_styles';

export interface RendererOptions {
  dataStyles: DataStyles;
  isDrillingEnabled?: boolean;
  onDrill?: DrillFunction;
  titleCase?: boolean;
  queryTimezone?: string;
  nextRendererOptions?: Partial<MalloyRenderProps>;
  useLegacy?: boolean;
}

export type DrillFunction = (
  drillQuery: string,
  target: HTMLElement,
  drillFilters: string[]
) => void;
