/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {Renderer} from './renderer';
import {createErrorElement, createNullElement, timeToString} from './utils';
import type {StyleDefaults, TimeRenderOptions} from './data_styles';
import type {RendererOptions} from './renderer_types';
import {RendererFactory} from './renderer_factory';
import type {Cell, Field} from '../data_tree';

export class HTMLDateRenderer implements Renderer {
  constructor(
    private readonly document: Document,
    private readonly queryTimezone: string | undefined
  ) {}

  async render(data: Cell): Promise<HTMLElement> {
    if (data.isNull()) {
      return createNullElement(this.document);
    }

    if (!data.isTime()) {
      return createErrorElement(
        this.document,
        'Invalid field for date renderer'
      );
    }

    const timeframe =
      data.field.timeframe ?? (data.field.isDate() ? 'day' : 'second');

    const value = data.value;

    const timestring = timeToString(value, timeframe, this.queryTimezone);

    const element = this.document.createElement('span');
    element.appendChild(this.document.createTextNode(timestring));
    return element;
  }
}

export class DateRendererFactory extends RendererFactory<TimeRenderOptions> {
  public static readonly instance = new DateRendererFactory();

  activates(field: Field): boolean {
    return field.isTime();
  }

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field,
    _options: TimeRenderOptions,
    timezone?: string
  ): Renderer {
    return new HTMLDateRenderer(document, timezone);
  }

  get rendererName() {
    return 'time';
  }
}
