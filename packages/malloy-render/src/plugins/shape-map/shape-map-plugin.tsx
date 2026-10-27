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
import {VegaLiteChart} from '@/component/vega/vega-lite-chart';
import {
  compileVegaLiteChart,
  type CompiledVegaLiteChart,
} from '@/component/vega/vega-lite-spec';
import type {
  GetResultMetadataOptions,
  RenderMetadata,
} from '@/component/render-result-metadata';
import {
  generateShapeMapSpec,
  getShapeMapSize,
  mapShapeRow,
  shapeMapTooltip,
} from './generate-shape_map-spec';

export const ShapeMapPluginFactory: RenderPluginFactory<SolidJSRenderPluginInstance> =
  {
    name: 'shape_map',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'shape_map',
      ownedPaths: [['shape_map']],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('shape_map');
      const isRepeatedRecord = fieldType === FieldType.RepeatedRecord;

      if (hasTag && !isRepeatedRecord) {
        throw new Error(
          'Malloy Shape Map: field is a shape map, but is not a repeated record. Try moving the tag to the line above the query, run, nest, or view declaration.'
        );
      }

      return hasTag && isRepeatedRecord;
    },

    create: (field: Field): SolidJSRenderPluginInstance => {
      if (!field.isNest()) {
        throw new Error('Malloy Shape Map: field must be a nested query');
      }
      let chart: CompiledVegaLiteChart | undefined;
      let useVegaInterpreter: boolean | undefined;
      const regionField = field.fields[0];
      const tooltip = shapeMapTooltip(field);

      return {
        name: 'shape_map',
        field,
        renderMode: 'solidjs',
        sizingStrategy: 'fixed',

        beforeRender: (
          _metadata: RenderMetadata,
          options: GetResultMetadataOptions
        ): void => {
          useVegaInterpreter = options.useVegaInterpreter;
          chart = compileVegaLiteChart(
            generateShapeMapSpec(
              field,
              options.getVegaConfigOverride?.('shape_map') ?? {},
              options.explicitTheme
            ),
            getShapeMapSize(field),
            useVegaInterpreter
          );
        },

        renderComponent: (props: RenderProps): JSXElement => {
          if (!props.dataColumn.isRepeatedRecord()) {
            throw new Error(
              'Malloy Shape Map: data column is not a repeated record'
            );
          }
          if (!chart) {
            throw new Error('Malloy Shape Map: missing Vega runtime');
          }
          return (
            <VegaLiteChart
              data={props.dataColumn}
              chart={chart}
              mapRow={row => mapShapeRow(row, regionField)}
              tooltip={tooltip}
              useVegaInterpreter={useVegaInterpreter}
            />
          );
        },

        getMetadata: () => ({type: 'shape_map', field}),
      };
    },
  };
