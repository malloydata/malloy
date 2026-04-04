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
import {getColorScale} from '@/html/utils';
import type {
  GetResultMetadataOptions,
  RenderMetadata,
} from '@/component/render-result-metadata';
import type {RenderLogCollector} from '@/component/render-log-collector';

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

function mapData(rows: RecordCell[]): Record<string, unknown>[] {
  return rows.map(row => {
    const mapped: Record<string, unknown> = {};
    for (const f of row.field.fields) {
      mapped[f.name] = getDataValue(row.column(f.name));
    }
    return mapped;
  });
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

export const SegmentMapPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
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

    create: (field: Field): DOMRenderPluginInstance => {
      let vegaConfigOverride: Record<string, unknown> = {};
      let logCollector: RenderLogCollector | undefined;

      return {
        name: 'segment_map',
        field,
        renderMode: 'dom',
        sizingStrategy: 'fixed',

        beforeRender: (
          _metadata: RenderMetadata,
          options: GetResultMetadataOptions
        ): void => {
          vegaConfigOverride =
            options.getVegaConfigOverride?.('segment_map') ?? {};
          logCollector = options.renderFieldMetadata.logCollector;
        },

        renderToDOM: (container: HTMLElement, props: RenderProps): void => {
          if (!props.dataColumn.isRepeatedRecord()) {
            throw new Error(
              'Malloy Segment Map: data column is not a repeated record'
            );
          }

          const data = props.dataColumn;
          const fields = data.field.fields;
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
                  scale: getColorScale(colorType, false),
                }
              : undefined;

          const spec: lite.TopLevelSpec = {
            ...getSize(field),
            data: {values: mapData(data.rows)},
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
            background: 'transparent',
            config: SEGMENT_MAP_VEGA_CONFIG,
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
              logCollector?.error(`Segment map render error: ${e}`);
            });
        },

        getMetadata: () => ({type: 'segment_map', field}),
      };
    },
  };
