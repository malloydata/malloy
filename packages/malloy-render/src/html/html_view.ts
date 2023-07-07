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

import {DataArray, Explore, Field, Result, Tags} from '@malloydata/malloy';
import {DataStyles, RenderDef, StyleDefaults} from '../data_styles';
import {ChildRenderers, Renderer} from '../renderer';
import {RendererOptions} from '../renderer_types';
import {HTMLJSONRenderer} from './json';
import {HTMLDashboardRenderer} from './dashboard';
import {HTMLListDetailRenderer} from './list_detail';
import {HTMLTableRenderer} from './table';
import {ContainerRenderer} from './container';
import {createErrorElement} from './utils';
import {MainRendererFactory} from '../main_renderer_factory';
import {HTMLListRenderer} from './list';

export class HTMLView {
  constructor(private document: Document) {}

  async render(result: Result, options: RendererOptions): Promise<HTMLElement> {
    const table = result.data;
    const renderer = makeRenderer(
      table.field,
      this.document,
      options,
      {
        size: 'large',
      },
      table.field.structDef.queryTimezone,
      result.getTags()
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
  'url': 'url',
  'list': 'list',
  'list_detail': 'list_detail',
  'sparkline': 'sparkline',
  'sparkline_area': 'sparkline',
  'sparkline_column': 'sparkline',
  'sparkline_bar': 'sparkline',
};

function getRendererOptions(field: Field | Explore, dataStyles: DataStyles) {
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
    if (name.endsWith(`_${suffix}`)) {
      const label = name.slice(0, name.length - suffix.length - 1);
      return updateOrCreateRenderer(suffix, label, suffixMap, renderer);
    }
  }
  return renderer;
}

function updateOrCreateRenderer(
  rendererKey: string,
  label: string,
  rendererMap: Record<string, RenderDef['renderer']>,
  renderer?: RenderDef
) {
  if (renderer) {
    renderer.renderer ??= rendererMap[rendererKey];
    renderer.data ??= {};
    renderer.data.label ??= label;
  } else {
    renderer = {
      renderer: rendererMap[rendererKey],
      data: {
        label,
      },
    };
  }

  return renderer!;
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
  tags?: Tags
): Renderer {
  const renderDef = getRendererOptions(field, options.dataStyles);
  options.dataStyles[field.name] = renderDef;

  const renderer = new MainRendererFactory().create(
    renderDef,
    tags?.getMalloyTags(),
    document,
    styleDefaults,
    options,
    field,
    queryTimezone
  );

  if (renderer) {
    return renderer;
  }

  if (renderDef?.renderer === 'dashboard') {
    return makeContainerRenderer(
      HTMLDashboardRenderer,
      document,
      isContainer(field),
      options
    );
  } else if (renderDef?.renderer === 'list') {
    return makeContainerRenderer(
      HTMLListRenderer,
      document,
      isContainer(field),
      options
    );
  } else if (renderDef?.renderer === 'list_detail') {
    return makeContainerRenderer(
      HTMLListDetailRenderer,
      document,
      isContainer(field),
      options
    );
  } else if (
    renderDef?.renderer === 'table' ||
    !field.hasParentExplore() ||
    field.isExploreField()
  ) {
    return makeContainerRenderer(
      HTMLTableRenderer,
      document,
      isContainer(field),
      options
    );
  }

  throw new Error(`Could not find a proper renderer for field ${field.name}`);
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
      field.getTags()
    );
  });
  c.childRenderers = result;
  return c;
}
