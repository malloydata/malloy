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
import {type Field, type Cell, type RecordCell, FieldType} from '@/data_tree';
import type {Tag} from '@malloydata/malloy-tag';
import type * as lite from 'vega-lite';
import type {JSXElement} from 'solid-js';
import {
  compileVegaLiteChart,
  VegaLiteChart,
  type CompiledVegaLiteChart,
} from '@/component/vega/vega-lite-chart';
import {VEGA_LITE_VALUES} from '@/component/vega/vega-lite-spec';
import usAtlas from 'us-atlas/states-10m.json';
import {mergeVegaConfigs} from '@/component/vega/merge-vega-configs';
import {getColorScale, mapCanvasBackground} from '@/html/utils';
import type {
  GetResultMetadataOptions,
  RenderMetadata,
} from '@/component/render-result-metadata';

function getDataType(field: Field): 'ordinal' | 'quantitative' | 'nominal' {
  if (field.isString()) return 'nominal';
  if (field.isNumber()) return 'quantitative';
  throw new Error('Invalid field type for segment map.');
}

function getDataValue(data: Cell): string | number | null {
  if (data.isNull()) return null;
  if (data.isNumber()) return data.value;
  if (data.isString()) return data.value;
  throw new Error('Invalid field type for segment map.');
}

function mapRow(row: RecordCell): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const f of row.field.fields) {
    mapped[f.name] = getDataValue(row.column(f.name));
  }
  return mapped;
}

function getSize(field: Field): {height: number; width: number} {
  return field.isRoot() ? {height: 350, width: 500} : {height: 175, width: 250};
}

const SEGMENT_MAP_VEGA_CONFIG: lite.Config = {
  axis: {
    labelFont: "var(--malloy-font-family, 'Inter')",
    titleFont: "var(--malloy-font-family, 'Inter')",
    titleFontWeight: 500 as const,
    titleColor: 'var(--malloy-title-color, #505050)',
    labelColor: 'var(--malloy-label-color, #000000)',
    titleFontSize: 12,
  },
  legend: {
    labelFont: "var(--malloy-font-family, 'Inter')",
    titleFont: "var(--malloy-font-family, 'Inter')",
    titleFontWeight: 500 as const,
    titleColor: 'var(--malloy-title-color, #505050)',
    labelColor: 'var(--malloy-label-color, #000000)',
    titleFontSize: 12,
  },
  header: {
    labelFont: "var(--malloy-font-family, 'Inter')",
    titleFont: "var(--malloy-font-family, 'Inter')",
    titleFontWeight: 500 as const,
  },
  mark: {font: "var(--malloy-font-family, 'Inter')"},
  title: {
    font: "var(--malloy-font-family, 'Inter')",
    subtitleFont: "var(--malloy-font-family, 'Inter')",
    fontWeight: 500 as const,
  },
};

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
          const vegaConfigOverride =
            options.getVegaConfigOverride?.('segment_map') ?? {};
          const explicitTheme = options.explicitTheme;
          const fields = field.fields;
          const lat1Field = fields[0];
          const lon1Field = fields[1];
          const lat2Field = fields[2];
          const lon2Field = fields[3];
          const colorField = fields[4];

          const colorType = colorField ? getDataType(colorField) : undefined;

          const colorDef =
            colorField !== undefined
              ? {
                  field: colorField.name,
                  type: colorType,
                  axis: {title: colorField.name},
                  scale: getColorScale(colorType, false, false, explicitTheme),
                }
              : undefined;

          const spec: lite.TopLevelSpec = {
            data: {name: VEGA_LITE_VALUES},
            projection: {type: 'albersUsa'},
            layer: [
              {
                data: {
                  values: usAtlas,
                  format: {type: 'topojson', feature: 'states'},
                },
                mark: {type: 'geoshape', fill: 'lightgray', stroke: 'white'},
              },
              {
                mark: 'line',
                encoding: {
                  latitude: {
                    field: lat1Field.name,
                    type: 'quantitative',
                  },
                  longitude: {
                    field: lon1Field.name,
                    type: 'quantitative',
                  },
                  latitude2: {field: lat2Field.name},
                  longitude2: {field: lon2Field.name},
                  color: colorDef,
                },
              },
            ],
            // Map canvas background from the embedder theme; an unset or
            // empty value falls back to transparent so the map blends with
            // the host chrome. `vegaConfigOverride` cannot change this: it
            // merges only into spec.config, which a top-level spec.background
            // shadows in Vega-Lite.
            background: mapCanvasBackground(explicitTheme),
            config: SEGMENT_MAP_VEGA_CONFIG,
          };

          spec.config = mergeVegaConfigs(spec.config ?? {}, vegaConfigOverride);

          chart = compileVegaLiteChart(
            spec,
            getSize(field),
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
              mapRow={mapRow}
              useVegaInterpreter={useVegaInterpreter}
            />
          );
        },

        getMetadata: () => ({type: 'segment_map', field}),
      };
    },
  };
