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

export function mapSegmentRow(row: RecordCell): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const f of row.field.fields) {
    mapped[f.name] = getDataValue(row.column(f.name));
  }
  return mapped;
}

/**
 * The tooltip for one segment. A text fifth column (such as a route name) is
 * the title. Otherwise each column is a labeled line.
 */
export function segmentMapTooltip(field: NestField) {
  const [lat1, lon1, lat2, lon2, colorField] = field.fields;
  const coordinates = [lat1, lon1, lat2, lon2];
  return (row: RecordCell): ChartTooltipEntry =>
    colorField?.isString()
      ? {title: [cellText(row, colorField)], entries: []}
      : {
          title: [],
          entries: [...coordinates, colorField]
            .filter(f => f !== undefined)
            .map(f => tooltipLine(row, f)),
        };
}

/**
 * The segment map's Vega-Lite spec. It reads its rows (see mapSegmentRow) from
 * ChartV2's values data source at render time.
 */
export function generateSegmentMapSpec(
  field: NestField,
  explicitTheme?: MalloyExplicitTheme
): lite.TopLevelSpec {
  const fields = field.fields;
  const lat1Field = fields[0];
  const lon1Field = fields[1];
  const lat2Field = fields[2];
  const lon2Field = fields[3];
  const colorField = fields[4];

  let colorDef;
  if (colorField !== undefined) {
    const colorType = getDataType(colorField);
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
  };
  return spec;
}
