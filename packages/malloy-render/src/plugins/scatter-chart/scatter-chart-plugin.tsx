/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {
  RenderPluginFactory,
  RenderProps,
  SolidJSRenderPluginInstance,
  RendererValidationSpec,
} from '@/api/plugin-types';
import {type Field, FieldType} from '@/data_tree';
import type {Tag} from '@malloydata/malloy-tag';
import type {JSXElement} from 'solid-js';
import {
  generateScatterChartSpec,
  getScatterSize,
  mapScatterRow,
} from './generate-scatter_chart-spec';
import {
  compileVegaLiteChart,
  VegaLiteChart,
  type CompiledVegaLiteChart,
} from '@/component/vega/vega-lite-chart';
import type {
  GetResultMetadataOptions,
  RenderMetadata,
} from '@/component/render-result-metadata';

export const ScatterChartPluginFactory: RenderPluginFactory<SolidJSRenderPluginInstance> =
  {
    name: 'scatter_chart',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'scatter_chart',
      ownedPaths: [['scatter_chart']],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('scatter_chart');
      const isRepeatedRecord = fieldType === FieldType.RepeatedRecord;

      if (hasTag && !isRepeatedRecord) {
        throw new Error(
          'Malloy Scatter Chart: field is a scatter chart, but is not a repeated record. Try moving the tag to the line above the query, run, nest, or view declaration.'
        );
      }

      return hasTag && isRepeatedRecord;
    },

    create: (field: Field): SolidJSRenderPluginInstance => {
      if (!field.isNest()) {
        throw new Error('Malloy Scatter Chart: field must be a nested query');
      }
      let chart: CompiledVegaLiteChart | undefined;
      let useVegaInterpreter: boolean | undefined;
      const timezone = field.root().queryTimezone;

      return {
        name: 'scatter_chart',
        field,
        renderMode: 'solidjs',
        sizingStrategy: 'fixed',

        beforeRender: (
          _metadata: RenderMetadata,
          options: GetResultMetadataOptions
        ): void => {
          useVegaInterpreter = options.useVegaInterpreter;
          chart = compileVegaLiteChart(
            generateScatterChartSpec(
              field,
              options.getVegaConfigOverride?.('scatter_chart') ?? {}
            ),
            getScatterSize(field),
            useVegaInterpreter
          );
        },

        renderComponent: (props: RenderProps): JSXElement => {
          if (!props.dataColumn.isRepeatedRecord()) {
            throw new Error(
              'Malloy Scatter Chart: data column is not a repeated record'
            );
          }
          if (!chart) {
            throw new Error('Malloy Scatter Chart: missing Vega runtime');
          }
          return (
            <VegaLiteChart
              data={props.dataColumn}
              chart={chart}
              mapRow={row => mapScatterRow(row, timezone)}
              useVegaInterpreter={useVegaInterpreter}
            />
          );
        },

        getMetadata: () => ({type: 'scatter_chart', field}),
      };
    },
  };
