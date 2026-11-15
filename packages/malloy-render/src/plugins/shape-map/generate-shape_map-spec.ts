/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Field, Cell, NestField, RecordCell} from '@/data_tree';
import type * as lite from 'vega-lite';
import usAtlas from 'us-atlas/states-10m.json';
import type {MalloyExplicitTheme} from '@/api/types';
import type {ChartTooltipEntry} from '@/component/types';
import {CHART_VALUES_DATA} from '@/component/chart/chart-values-data';
import {
  cellText,
  colorFieldScale,
  tooltipLine,
  usMapFrame,
} from '@/component/vega/vega-lite-spec';
import {STATE_CODES} from '@/html/state_codes';

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
export function mapShapeRow(
  row: RecordCell,
  regionField: Field
): Record<string, unknown> | undefined {
  const mapped: Record<string, unknown> = {};
  for (const f of row.field.fields) {
    mapped[f.name] = getDataValue(row.column(f.name), regionField);
  }
  return mapped[regionField.name] === undefined ? undefined : mapped;
}

/** The tooltip for one state: its name as the title, then its value. */
export function shapeMapTooltip(field: NestField) {
  const [regionField, colorField] = field.fields;
  return (row: RecordCell): ChartTooltipEntry => ({
    title: [cellText(row, regionField)],
    entries: colorField ? [tooltipLine(row, colorField)] : [],
  });
}

/**
 * The shape map's Vega-Lite spec. It reads its rows (see mapShapeRow) from
 * ChartV2's values data source at render time.
 */
export function generateShapeMapSpec(
  field: NestField,
  explicitTheme?: MalloyExplicitTheme
): lite.TopLevelSpec {
  const regionField = field.fields[0];
  const colorField = field.fields[1];

  let colorDef;
  if (colorField !== undefined) {
    const colorType = getDataType(colorField, regionField);
    colorDef = {
      field: colorField.name,
      type: colorType,
      legend: {title: colorField.getLabel()},
      scale: colorFieldScale(colorType, explicitTheme),
    };
  }

  const spec: lite.TopLevelSpec = {
    ...usMapFrame(explicitTheme),
    data: {name: CHART_VALUES_DATA},
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
  };
  return spec;
}
