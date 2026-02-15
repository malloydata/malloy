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

import type {Tag} from '@malloydata/malloy-tag';
import type {DataStyles, RenderDef, StyleDefaults} from './data_styles';
import type {ChildRenderers, Renderer} from './renderer';
import type {RendererOptions} from './renderer_types';
import {HTMLJSONRenderer} from './json';
import {HTMLTableRenderer} from './table';
import {ContainerRenderer} from './container';
import {createErrorElement} from './utils';
import {MainRendererFactory} from './main_renderer_factory';
import type * as Malloy from '@malloydata/malloy-interfaces';
import type {Cell, Field, RecordOrRepeatedRecordField} from '../data_tree';
import {getDataTree} from '../data_tree';
import {HTMLDashboardRenderer} from './dashboard';
import {HTMLListRenderer} from './list';
import {HTMLListDetailRenderer} from './list_detail';
import {tagFromAnnotations} from '../util';
import {MalloyRenderer} from '@/api/malloy-renderer';
import type {MalloyViz} from '@/api/malloy-viz';

export class HTMLView {
  private lastRenderedElement: HTMLElement | null = null;
  private lastViz: MalloyViz | null = null;

  constructor(private document: Document) {}

  async render(
    malloyResult: Malloy.Result,
    options: RendererOptions
  ): Promise<HTMLElement> {
    const modelTag = tagFromAnnotations(malloyResult.model_annotations, '## ');
    const useLegacyRenderer =
      modelTag.has('renderer_legacy') || options.useLegacy === true;
    if (!useLegacyRenderer) {
      const renderer = new MalloyRenderer();
      const nextRendererOptions = options.nextRendererOptions ?? {};
      const viz = renderer.createViz(nextRendererOptions);
      viz.setResult(malloyResult);
      const el = this.document.createElement('div');
      viz.render(el);
      this.lastRenderedElement = el;
      this.lastViz = viz;
      return el;
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        'Tried to use the new Malloy renderer, but the malloy-render component was not found. Falling back to the legacy renderer.'
      );
    }
    const rootCell = getDataTree(malloyResult);
    const renderer = makeRenderer(
      rootCell.field,
      this.document,
      options,
      {
        size: 'large',
      },
      rootCell.field.queryTimezone,
      rootCell.field.tag
    );
    try {
      // TODO Implement row streaming capability for some renderers: some renderers should be usable
      //      as a builder with `begin(field: StructDef)`, `row(field: StructDef, row: QueryRecord)`,
      //      and `end(field: StructDef)` methods.
      //      Primarily, this should be possible for the `table` and `dashboard` renderers.
      //      This would only be used at this top level (and HTML view should support `begin`,
      //      `row`, and `end` as well).
      const el = await renderer.render(rootCell);
      this.lastRenderedElement = el;
      this.lastViz = null;
      return el;
    } catch (error) {
      if (error instanceof Error) {
        const errorEl = createErrorElement(this.document, error);
        this.lastRenderedElement = errorEl;
        this.lastViz = null;
        return errorEl;
      } else {
        const errorEl = createErrorElement(
          this.document,
          'Internal error - Exception not an Error object.'
        );
        this.lastRenderedElement = errorEl;
        this.lastViz = null;
        return errorEl;
      }
    }
  }

  async getHTML(): Promise<string> {
    if (!this.lastRenderedElement) {
      throw new Error('No element has been rendered yet');
    }

    // If we have a MalloyViz instance, use its getHTML method
    if (this.lastViz) {
      return this.lastViz.getHTML();
    }

    // Otherwise use the legacy renderer's innerHTML
    return this.lastRenderedElement.innerHTML;
  }
}

export class JSONView {
  constructor(private document: Document) {}

  async render(table: Cell): Promise<HTMLElement> {
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

function getRendererOptions(field: Field, dataStyles: DataStyles) {
  const renderer = dataStyles[field.name];

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

function isContainer(field: Field): RecordOrRepeatedRecordField {
  if (field.isRecordOrRepeatedRecord()) {
    return field;
  } else {
    throw new Error(
      `${field.name} does not contain fields and cannot be rendered this way`
    );
  }
}

export function makeRenderer(
  field: Field,
  document: Document,
  options: RendererOptions,
  styleDefaults: StyleDefaults,
  queryTimezone: string | undefined,
  tagged: Tag
): Renderer {
  const renderDef = getRendererOptions(field, options.dataStyles);
  options.dataStyles[field.name] = renderDef;

  const renderer = new MainRendererFactory().create(
    renderDef,
    tagged,
    document,
    styleDefaults,
    options,
    field,
    queryTimezone
  );

  if (renderer) {
    return renderer;
  }

  if (renderDef?.renderer === 'dashboard' || tagged.has('dashboard')) {
    return makeContainerRenderer(
      HTMLDashboardRenderer,
      document,
      isContainer(field),
      options,
      tagged
    );
  } else if (renderDef?.renderer === 'list' || tagged.has('list')) {
    return makeContainerRenderer(
      HTMLListRenderer,
      document,
      isContainer(field),
      options,
      tagged
    );
  } else if (
    renderDef?.renderer === 'list_detail' ||
    tagged.has('list_detail')
  ) {
    return makeContainerRenderer(
      HTMLListDetailRenderer,
      document,
      isContainer(field),
      options,
      tagged
    );
  } else if (
    renderDef?.renderer === 'table' ||
    tagged.has('table') ||
    field.isRecordOrRepeatedRecord()
  ) {
    return makeContainerRenderer(
      HTMLTableRenderer,
      document,
      isContainer(field),
      options,
      tagged
    );
  }

  throw new Error(`Could not find a proper renderer for field ${field.name}`);
}

function makeContainerRenderer<Type extends ContainerRenderer>(
  cType: new (
    document: Document,
    options: RendererOptions,
    tagged: Tag
  ) => Type,
  document: Document,
  explore: RecordOrRepeatedRecordField,
  options: RendererOptions,
  tagged: Tag
): ContainerRenderer {
  const c = ContainerRenderer.make(cType, document, explore, options, tagged);
  const result: ChildRenderers = {};
  explore.fields.forEach((field: Field) => {
    result[field.name] = makeRenderer(
      field,
      document,
      options,
      c.defaultStylesForChildren,
      field.getEffectiveQueryTimezone(),
      field.tag
    );
  });
  c.childRenderers = result;
  return c;
}
