/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  RenderPluginFactory,
  RenderProps,
  DOMRenderPluginInstance,
  RendererValidationSpec,
} from '@/api/plugin-types';
import {type Field, type Cell, type RecordCell, FieldType} from '@/data_tree';
import type {Tag} from '@malloydata/malloy-tag';
import * as lite from 'vega-lite';
import * as vega from 'vega';
import usAtlas from 'us-atlas/states-10m.json';
import {mergeVegaConfigs} from '@/component/vega/merge-vega-configs';
import {STATE_CODES} from '@/html/state_codes';
import {getColorScale} from '@/html/utils';
import type {
  GetResultMetadataOptions,
  RenderMetadata,
} from '@/component/render-result-metadata';
import type {RenderLogCollector} from '@/component/render-log-collector';

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

function mapData(
  rows: RecordCell[],
  regionField: Field
): Record<string, unknown>[] {
  return rows.map(row => {
    const mapped: Record<string, unknown> = {};
    for (const f of row.field.fields) {
      mapped[f.name] = getDataValue(row.column(f.name), regionField);
    }
    return mapped;
  });
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

export const ShapeMapPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
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

    create: (field: Field): DOMRenderPluginInstance => {
      let vegaConfigOverride: Record<string, unknown> = {};
      let logCollector: RenderLogCollector | undefined;

      return {
        name: 'shape_map',
        field,
        renderMode: 'dom',
        sizingStrategy: 'fixed',

        beforeRender: (
          _metadata: RenderMetadata,
          options: GetResultMetadataOptions
        ): void => {
          vegaConfigOverride =
            options.getVegaConfigOverride?.('shape_map') ?? {};
          logCollector = options.renderFieldMetadata.logCollector;
        },

        renderToDOM: (container: HTMLElement, props: RenderProps): void => {
          if (!props.dataColumn.isRepeatedRecord()) {
            throw new Error(
              'Malloy Shape Map: data column is not a repeated record'
            );
          }

          const data = props.dataColumn;
          const regionField = data.field.fields[0];
          const colorField = data.field.fields[1];

          const colorType = colorField
            ? getDataType(colorField, regionField)
            : undefined;

          const colorDef =
            colorField !== undefined
              ? {
                  field: colorField.name,
                  type: colorType,
                  axis: {title: colorField.name},
                  scale: getColorScale(colorType, false),
                }
              : undefined;

          const mapped = mapData(data.rows, regionField).filter(
            row => row[regionField.name] !== undefined
          );

          const spec: lite.TopLevelSpec = {
            ...getSize(field),
            data: {values: mapped},
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
            background: 'transparent',
            config: SHAPE_MAP_VEGA_CONFIG,
          };

          spec.config = mergeVegaConfigs(spec.config ?? {}, vegaConfigOverride);

          const vegaSpec = lite.compile(spec).spec;
          const view = new vega.View(vega.parse(vegaSpec), {
            renderer: 'none',
          });
          view.logger().level(-1);
          view
            .toSVG()
            .then(svg => {
              container.innerHTML = svg;
            })
            .catch(e => {
              logCollector?.error(`Shape map render error: ${e}`);
            });
        },

        getMetadata: () => ({type: 'shape_map', field}),
      };
    },
  };
