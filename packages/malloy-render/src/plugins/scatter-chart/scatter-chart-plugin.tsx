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
import {mergeVegaConfigs} from '@/component/vega/merge-vega-configs';
import {DEFAULT_SPEC} from '@/html/vega_spec';
import {getColorScale, normalizeToTimezone} from '@/html/utils';
import type {
  GetResultMetadataOptions,
  RenderMetadata,
} from '@/component/render-result-metadata';
import type {RenderLogCollector} from '@/component/render-log-collector';

function getDataType(
  field: Field
): 'temporal' | 'ordinal' | 'quantitative' | 'nominal' {
  if (field.isTime()) return 'temporal';
  if (field.isString()) return 'nominal';
  if (field.isNumber()) return 'quantitative';
  throw new Error('Invalid field type for scatter chart.');
}

function getDataValue(data: Cell): Date | string | number | null {
  if (data.isNull()) return null;
  if (data.isTime() || data.isString()) return data.value;
  if (data.isNumber()) return data.value;
  throw new Error('Invalid field type for scatter chart.');
}

function mapData(
  rows: RecordCell[],
  timezone: string | undefined
): Record<string, unknown>[] {
  return rows.map(row => {
    const mapped: Record<string, unknown> = {};
    for (const f of row.field.fields) {
      let value = getDataValue(row.column(f.name));
      if (value instanceof Date) {
        value = normalizeToTimezone(value, timezone);
      }
      mapped[f.name] = value;
    }
    return mapped;
  });
}

function getSize(field: Field): {height: number; width: number} {
  return field.isRoot() ? {height: 350, width: 500} : {height: 175, width: 250};
}

export const ScatterChartPluginFactory: RenderPluginFactory<DOMRenderPluginInstance> =
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

    create: (field: Field): DOMRenderPluginInstance => {
      let vegaConfigOverride: Record<string, unknown> = {};
      let logCollector: RenderLogCollector | undefined;

      return {
        name: 'scatter_chart',
        field,
        renderMode: 'dom',
        sizingStrategy: 'fixed',

        beforeRender: (
          _metadata: RenderMetadata,
          options: GetResultMetadataOptions
        ): void => {
          vegaConfigOverride =
            options.getVegaConfigOverride?.('scatter_chart') ?? {};
          logCollector = options.renderFieldMetadata.logCollector;
        },

        renderToDOM: (container: HTMLElement, props: RenderProps): void => {
          if (!props.dataColumn.isRepeatedRecord()) {
            throw new Error(
              'Malloy Scatter Chart: data column is not a repeated record'
            );
          }

          const data = props.dataColumn;
          const fields = data.field.fields;
          const xField = fields[0];
          const yField = fields[1];
          const colorField = fields[2];
          const sizeField = fields[3];
          const shapeField = fields[4];

          const xType = getDataType(xField);
          const yType = getDataType(yField);
          const colorType = colorField ? getDataType(colorField) : undefined;
          const sizeType = sizeField ? getDataType(sizeField) : undefined;
          const shapeType = shapeField ? getDataType(shapeField) : undefined;

          const timezone = field.root().queryTimezone;

          const colorDef =
            colorField !== undefined
              ? {
                  field: colorField.name,
                  type: colorType,
                  axis: {title: colorField.name},
                  scale: getColorScale(colorType, false),
                }
              : {value: '#4285F4'};

          const sizeDef = sizeField
            ? {
                field: sizeField.name,
                type: sizeType,
                axis: {title: sizeField.name},
              }
            : undefined;

          const shapeDef = shapeField
            ? {
                field: shapeField.name,
                type: shapeType,
                axis: {title: shapeField.name},
              }
            : undefined;

          const xSort = xType === 'nominal' ? null : undefined;
          const ySort = yType === 'nominal' ? null : undefined;

          const spec: lite.TopLevelSpec = {
            ...DEFAULT_SPEC,
            ...getSize(field),
            data: {values: mapData(data.rows, timezone)},
            mark: 'point',
            encoding: {
              x: {
                field: xField.name,
                type: xType,
                sort: xSort,
                axis: {title: xField.name},
                scale: {zero: false},
              },
              y: {
                field: yField.name,
                type: yType,
                sort: ySort,
                axis: {title: yField.name},
                scale: {zero: false},
              },
              size: sizeDef,
              color: colorDef,
              shape: shapeDef,
            },
            background: 'transparent',
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
              logCollector?.error(`Scatter chart render error: ${e}`);
            });
        },

        getMetadata: () => ({type: 'scatter_chart', field}),
      };
    },
  };
