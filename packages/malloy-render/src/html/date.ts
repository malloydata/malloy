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

import {Renderer} from './renderer';
import {createErrorElement, createNullElement, timeToString} from './utils';
import {StyleDefaults, TimeRenderOptions} from './data_styles';
import {RendererOptions} from './renderer_types';
import {RendererFactory} from './renderer_factory';
import * as Malloy from '@malloydata/malloy-interfaces';
import {getCellValue, isAtomic, isDate, isTimestamp} from '../component/util';

export class HTMLDateRenderer implements Renderer {
  constructor(
    private readonly document: Document,
    private readonly queryTimezone: string | undefined
  ) {}

  async render(
    data: Malloy.Cell,
    field: Malloy.DimensionInfo
  ): Promise<HTMLElement> {
    if (data.kind === 'null_cell') {
      return createNullElement(this.document);
    }

    if (
      (data.kind !== 'date_cell' && data.kind !== 'timestamp_cell') ||
      (!isDate(field) && !isTimestamp(field))
    ) {
      return createErrorElement(
        this.document,
        'Invalid field for date renderer'
      );
    }

    const timeframe =
      field.type.timeframe || (isDate(field) ? 'day' : 'second');

    const value = getCellValue(data) as Date;

    const timestring = timeToString(value, timeframe, this.queryTimezone);

    const element = this.document.createElement('span');
    element.appendChild(this.document.createTextNode(timestring));
    return element;
  }
}

export class DateRendererFactory extends RendererFactory<TimeRenderOptions> {
  public static readonly instance = new DateRendererFactory();

  activates(field: Malloy.DimensionInfo): boolean {
    return (
      field.hasParentExplore() &&
      isAtomic(field) &&
      (isDate(field) || isTimestamp(field))
    );
  }

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Malloy.DimensionInfo,
    _options: TimeRenderOptions,
    timezone?: string
  ): Renderer {
    return new HTMLDateRenderer(document, timezone);
  }

  get rendererName() {
    return 'time';
  }
}
