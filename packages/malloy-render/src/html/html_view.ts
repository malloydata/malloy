/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {AtomicFieldType, DataArray, Explore, Field} from '@malloydata/malloy';
import {TopLevelSpec} from 'vega-lite';
import {DataStyles, RenderDef, StyleDefaults} from '../data_styles';
import {ChildRenderers, Renderer} from '../renderer';
import {RendererOptions} from '../renderer_types';
import {HTMLBarChartRenderer} from './bar_chart';
import {HTMLBooleanRenderer} from './boolean';
import {HTMLJSONRenderer} from './json';
import {HTMLBytesRenderer} from './bytes';
import {HTMLCurrencyRenderer} from './currency';
import {HTMLPercentRenderer} from './percent';
import {HTMLDashboardRenderer} from './dashboard';
import {HTMLImageRenderer} from './image';
import {HTMLDateRenderer} from './date';
import {HTMLLineChartRenderer} from './line_chart';
import {HTMLLinkRenderer} from './link';
import {HTMLListRenderer} from './list';
import {HTMLListDetailRenderer} from './list_detail';
import {HTMLNumberRenderer} from './number';
import {HTMLPointMapRenderer} from './point_map';
import {HTMLScatterChartRenderer} from './scatter_chart';
import {HTMLSegmentMapRenderer} from './segment_map';
import {HTMLShapeMapRenderer} from './shape_map';
import {HTMLSparkLineRenderer} from './sparkline';
import {HTMLTableRenderer} from './table';
import {HTMLTextRenderer} from './text';
import {HTMLVegaSpecRenderer} from './vega_spec';
import {ContainerRenderer} from './container';
import {createErrorElement} from './utils';
import {HTMLUnsupportedRenderer} from './unsupported';
import {HTMLColumnSparkLineRenderer} from './column_sparkline';
import {HTMLBarSparkLineRenderer} from './bar_sparkline';
import {HTMLAreaSparkLineRenderer} from './area_sparkline';

export class HTMLView {
  constructor(private document: Document) {}

  async render(
    table: DataArray,
    options: RendererOptions,
    tagProperties: Record<string, string | boolean>
  ): Promise<HTMLElement> {
    const renderer = makeRenderer(
      table.field,
      this.document,
      options,
      {
        size: 'large',
      },
      table.field.structDef.queryTimezone,
      tagProperties
    );
    try {
      // TODO Implement row streaming capability for some renderers: some renderers should be usable
      //      as a builder with `begin(field: StructDef)`, `row(field: StructDef, row: QueryDataRow)`,
      //      and `end(field: StructDef)` methods.
      //      Primarily, this should be possible for the `table` and `dashboard` renderers.
      //      This would only be used at this top level (and HTML view should support `begin`,
      //      `row`, and `end` as well).
      return await renderer.render(table);
    } catch (error) {
      if (error instanceof Error) {
        return createErrorElement(this.document, error);
      } else {
        return createErrorElement(
          this.document,
          'Internal error - Exception not an Error object.'
        );
      }
    }
  }
}

export class JSONView {
  constructor(private document: Document) {}

  async render(table: DataArray): Promise<HTMLElement> {
    const renderer = new HTMLJSONRenderer(this.document);
    try {
      return await renderer.render(table);
    } catch (error) {
      if (error instanceof Error) {
        return createErrorElement(this.document, error);
      } else {
        return createErrorElement(
          this.document,
          'Internal error - Exception not an Error object.'
        );
      }
    }
  }
}

const suffixMap: Record<string, RenderDef['renderer']> = {
  'shape_map': 'shape_map',
  'point_map': 'point_map',
  'bar_chart': 'bar_chart',
  'image': 'image',
  'json': 'json',
  'segment_map': 'segment_map',
  'dashboard': 'dashboard',
  'line_chart': 'line_chart',
  'scatter_chart': 'scatter_chart',
  'url': 'link',
  'list': 'list',
  'list_detail': 'list_detail',
  'sparkline': 'sparkline',
  'sparkline_area': 'sparkline',
  'sparkline_column': 'sparkline',
  'sparkline_bar': 'sparkline',
};

function getRendererOptions(
  field: Field | Explore,
  dataStyles: DataStyles,
  tagProperties: Record<string, string | boolean>
) {
  let renderer = dataStyles[field.name];
  if (!renderer) {
    for (const sourceClass of field.sourceClasses) {
      if (!renderer) {
        renderer = dataStyles[sourceClass];
      }
    }
  }

  const {name} = field;
  for (const suffix in suffixMap) {
    if (tagProperties[suffix] === true) {
      return updateOrCreateRenderer(suffix, name, renderer);
    }

    if (name.endsWith(`_${suffix}`)) {
      const label = name.slice(0, name.length - suffix.length - 1);
      updateOrCreateRenderer(suffix, label, renderer);
      break;
    }
  }

  return renderer;
}

function updateOrCreateRenderer(
  rendererKey: string,
  label: string,
  renderer?: RenderDef
) {
  if (renderer) {
    renderer.renderer ??= suffixMap[rendererKey];
    renderer.data ??= {};
    renderer.data.label ??= label;
  } else {
    renderer = {
      renderer: suffixMap[rendererKey],
      data: {
        label,
      },
    };
  }

  return renderer;
}

function isContainer(field: Field | Explore): Explore {
  if (field.isExplore()) {
    return field;
  } else {
    throw new Error(
      `${field.name} does not contain fields and cannot be rendered this way`
    );
  }
}

export function makeRenderer(
  field: Explore | Field,
  document: Document,
  options: RendererOptions,
  styleDefaults: StyleDefaults,
  queryTimezone: string | undefined,
  tagProperties: Record<string, string | boolean>
): Renderer {
  const renderDef =
    getRendererOptions(field, options.dataStyles, tagProperties) || {};
  options.dataStyles[field.name] = renderDef;

  if (renderDef.renderer === 'shape_map') {
    return new HTMLShapeMapRenderer(
      document,
      styleDefaults,
      options,
      renderDef,
      queryTimezone
    );
  } else if (renderDef.renderer === 'point_map') {
    return new HTMLPointMapRenderer(
      document,
      styleDefaults,
      options,
      renderDef,
      queryTimezone
    );
  } else if (renderDef.renderer === 'image') {
    return new HTMLImageRenderer(document);
  } else if (renderDef.renderer === 'segment_map') {
    return new HTMLSegmentMapRenderer(
      document,
      styleDefaults,
      options,
      renderDef,
      queryTimezone
    );
  } else if (renderDef.renderer === 'dashboard') {
    return makeContainerRenderer(
      HTMLDashboardRenderer,
      document,
      isContainer(field),
      options
    );
  } else if (renderDef.renderer === 'json') {
    return new HTMLJSONRenderer(document);
  } else if (renderDef.renderer === 'line_chart') {
    return new HTMLLineChartRenderer(
      document,
      styleDefaults,
      options,
      renderDef,
      queryTimezone
    );
  } else if (renderDef.renderer === 'sparkline') {
    if (field.name.endsWith('_column')) {
      return new HTMLColumnSparkLineRenderer(
        document,
        styleDefaults,
        options,
        renderDef,
        queryTimezone
      );
    } else if (field.name.endsWith('_bar')) {
      return new HTMLBarSparkLineRenderer(
        document,
        styleDefaults,
        options,
        renderDef,
        queryTimezone
      );
    } else if (field.name.endsWith('area')) {
      return new HTMLAreaSparkLineRenderer(
        document,
        styleDefaults,
        options,
        renderDef,
        queryTimezone
      );
    }
    return new HTMLSparkLineRenderer(
      document,
      styleDefaults,
      options,
      renderDef,
      queryTimezone
    );
  } else if (renderDef.renderer === 'scatter_chart') {
    return new HTMLScatterChartRenderer(
      document,
      styleDefaults,
      options,
      renderDef,
      queryTimezone
    );
  } else if (renderDef.renderer === 'bar_chart') {
    return new HTMLBarChartRenderer(
      document,
      styleDefaults,
      options,
      renderDef,
      queryTimezone
    );
  } else if (renderDef.renderer === 'vega') {
    const spec = renderDef.spec;
    if (spec) {
      return new HTMLVegaSpecRenderer(
        document,
        styleDefaults,
        options,
        spec as TopLevelSpec
      );
    } else if (renderDef.spec_name) {
      const vegaRenderer = options.dataStyles[renderDef.spec_name];
      if (vegaRenderer !== undefined && vegaRenderer.renderer === 'vega') {
        if (vegaRenderer.spec) {
          return new HTMLVegaSpecRenderer(
            document,
            styleDefaults,
            options,
            vegaRenderer.spec as TopLevelSpec
          );
        } else {
          throw new Error(`No spec defined on ${renderDef.spec_name}`);
        }
      } else {
        throw new Error(`No Vega renderer named ${renderDef.spec_name}`);
      }
    } else {
      throw new Error(`No top level vega spec defined for ${field.name}`);
    }
  } else {
    if (
      renderDef.renderer === 'time' ||
      (field.hasParentExplore() &&
        field.isAtomicField() &&
        (field.type === AtomicFieldType.Date ||
          field.type === AtomicFieldType.Timestamp))
    ) {
      return new HTMLDateRenderer(document, queryTimezone);
    } else if (renderDef.renderer === 'currency') {
      return new HTMLCurrencyRenderer(document);
    } else if (renderDef.renderer === 'percent') {
      return new HTMLPercentRenderer(document);
    } else if (
      renderDef.renderer === 'number' ||
      (field.hasParentExplore() &&
        field.isAtomicField() &&
        field.type === AtomicFieldType.Number)
    ) {
      return new HTMLNumberRenderer(document);
    } else if (renderDef.renderer === 'bytes') {
      return new HTMLBytesRenderer(document);
    } else if (
      renderDef.renderer === 'boolean' ||
      (field.hasParentExplore() &&
        field.isAtomicField() &&
        field.type === AtomicFieldType.Boolean)
    ) {
      return new HTMLBooleanRenderer(document);
    } else if (renderDef.renderer === 'link') {
      return new HTMLLinkRenderer(document);
    } else if (renderDef.renderer === 'list') {
      return makeContainerRenderer(
        HTMLListRenderer,
        document,
        isContainer(field),
        options
      );
    } else if (renderDef.renderer === 'list_detail') {
      return makeContainerRenderer(
        HTMLListDetailRenderer,
        document,
        isContainer(field),
        options
      );
    } else if (
      renderDef.renderer === 'table' ||
      !field.hasParentExplore() ||
      field.isExploreField()
    ) {
      return makeContainerRenderer(
        HTMLTableRenderer,
        document,
        isContainer(field),
        options
      );
    } else if (field.isAtomicField() && field.isUnsupported()) {
      return new HTMLUnsupportedRenderer(document);
    } else {
      return new HTMLTextRenderer(document);
    }
  }
}

function makeContainerRenderer<Type extends ContainerRenderer>(
  cType: new (document: Document, options: RendererOptions) => Type,
  document: Document,
  explore: Explore,
  options: RendererOptions
): ContainerRenderer {
  const c = ContainerRenderer.make(cType, document, explore, options);
  const result: ChildRenderers = {};
  explore.intrinsicFields.forEach((field: Field) => {
    result[field.name] = makeRenderer(
      field,
      document,
      options,
      c.defaultStylesForChildren,
      explore.queryTimezone,
      field.getTags().getMalloyTags().properties
    );
  });
  c.childRenderers = result;
  return c;
}