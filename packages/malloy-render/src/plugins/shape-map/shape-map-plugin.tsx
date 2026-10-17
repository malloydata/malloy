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
import {STATE_CODES} from '@/html/state_codes';
import {getColorScale, mapCanvasBackground} from '@/html/utils';
import type {
  GetResultMetadataOptions,
  RenderMetadata,
} from '@/component/render-result-metadata';

function getDataType(
  field: Field,
  regionField: Field
): 'temporal' | 'ordinal' | 'quantitative' | 'nominal' {
  if (field.isBasic()) {
    if (field.isTime()) return 'nominal';
    if (field.isString()) {
      return field === regionField ? 'quantitative' : 'nominal';
    }
    if (field.isNumber()) return 'quantitative';
  }
  throw new Error('Invalid field type for shape map.');
}

function getDataValue(
  data: Cell,
  regionField: Field
): Date | string | number | null | undefined {
  if (data.isNumber()) return data.value;
  if (data.isString()) {
    if (data.field === regionField) {
      const id = STATE_CODES[data.value];
      return id === undefined ? undefined : id;
    }
    return data.value;
  }
  if (data.isNull()) return undefined;
  throw new Error('Invalid field type for shape map.');
}

// One row's record for the map; undefined when its region is not a known
// state, since such a row has nowhere to be drawn.
function mapRow(
  row: RecordCell,
  regionField: Field
): Record<string, unknown> | undefined {
  const mapped: Record<string, unknown> = {};
  for (const f of row.field.fields) {
    mapped[f.name] = getDataValue(row.column(f.name), regionField);
  }
  return mapped[regionField.name] === undefined ? undefined : mapped;
}

function getSize(field: Field): {height: number; width: number} {
  return field.isRoot() ? {height: 350, width: 500} : {height: 175, width: 250};
}

const SHAPE_MAP_VEGA_CONFIG: lite.Config = {
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
          const vegaConfigOverride =
            options.getVegaConfigOverride?.('shape_map') ?? {};
          const explicitTheme = options.explicitTheme;
          const colorField = field.fields[1];

          const colorType = colorField
            ? getDataType(colorField, regionField)
            : undefined;

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
                mark: {type: 'geoshape', fill: '#efefef', stroke: 'white'},
              },
              {
                transform: [
                  {
                    lookup: regionField.name,
                    from: {
                      data: {
                        values: usAtlas,
                        format: {type: 'topojson', feature: 'states'},
                      },
                      key: 'id',
                    },
                    as: 'geo',
                  },
                ],
                mark: 'geoshape',
                encoding: {
                  shape: {field: 'geo', type: 'geojson'},
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
            config: SHAPE_MAP_VEGA_CONFIG,
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
              mapRow={row => mapRow(row, regionField)}
              useVegaInterpreter={useVegaInterpreter}
            />
          );
        },

        getMetadata: () => ({type: 'shape_map', field}),
      };
    },
  };
