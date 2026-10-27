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
  generateSegmentMapSpec,
  getSegmentMapSize,
  mapSegmentRow,
  segmentMapTooltip,
} from './generate-segment_map-spec';

export const SegmentMapPluginFactory: RenderPluginFactory<SolidJSRenderPluginInstance> =
  {
    name: 'segment_map',

    getValidationSpec: (): RendererValidationSpec => ({
      renderer: 'segment_map',
      ownedPaths: [['segment_map']],
    }),

    matches: (field: Field, fieldTag: Tag, fieldType: FieldType): boolean => {
      const hasTag = fieldTag.has('segment_map');
      const isRepeatedRecord = fieldType === FieldType.RepeatedRecord;

      if (hasTag && !isRepeatedRecord) {
        throw new Error(
          'Malloy Segment Map: field is a segment map, but is not a repeated record. Try moving the tag to the line above the query, run, nest, or view declaration.'
        );
      }

      return hasTag && isRepeatedRecord;
    },

    create: (field: Field): SolidJSRenderPluginInstance => {
      if (!field.isNest()) {
        throw new Error('Malloy Segment Map: field must be a nested query');
      }
      let chart: CompiledVegaLiteChart | undefined;
      let useVegaInterpreter: boolean | undefined;
      const tooltip = segmentMapTooltip(field);

      return {
        name: 'segment_map',
        field,
        renderMode: 'solidjs',
        sizingStrategy: 'fixed',

        beforeRender: (
          _metadata: RenderMetadata,
          options: GetResultMetadataOptions
        ): void => {
          useVegaInterpreter = options.useVegaInterpreter;
          chart = compileVegaLiteChart(
            generateSegmentMapSpec(
              field,
              options.getVegaConfigOverride?.('segment_map') ?? {},
              options.explicitTheme
            ),
            getSegmentMapSize(field),
            useVegaInterpreter
          );
        },

        renderComponent: (props: RenderProps): JSXElement => {
          if (!props.dataColumn.isRepeatedRecord()) {
            throw new Error(
              'Malloy Segment Map: data column is not a repeated record'
            );
          }
          if (!chart) {
            throw new Error('Malloy Segment Map: missing Vega runtime');
          }
          return (
            <VegaLiteChart
              data={props.dataColumn}
              chart={chart}
              mapRow={mapSegmentRow}
              tooltip={tooltip}
              useVegaInterpreter={useVegaInterpreter}
            />
          );
        },

        getMetadata: () => ({type: 'segment_map', field}),
      };
    },
  };
