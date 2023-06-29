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

import {
  AtomicFieldType,
  DataColumn,
  DateTimeframe,
  Explore,
  Field,
  TimestampTimeframe,
} from '@malloydata/malloy';
import {Renderer} from '../renderer';
import {createErrorElement, createNullElement, timeToString} from './utils';
import {StyleDefaults, TimeRenderOptions} from '../data_styles';
import {RendererOptions} from '../renderer_types';
import {RendererFactory} from '../renderer_factory';

export class HTMLDateRenderer implements Renderer {
  constructor(
    private readonly document: Document,
    private readonly queryTimezone: string | undefined
  ) {}

  async render(data: DataColumn): Promise<HTMLElement> {
    if (data.isNull()) {
      return createNullElement(this.document);
    }

    if (!data.isDate() && !data.isTimestamp()) {
      return createErrorElement(
        this.document,
        'Invalid field for date renderer'
      );
    }

    const timeframe =
      data.field.timeframe ||
      (data.isTimestamp() ? TimestampTimeframe.Second : DateTimeframe.Day);

    const timestring = timeToString(data.value, timeframe, this.queryTimezone);

    const element = this.document.createElement('span');
    element.appendChild(this.document.createTextNode(timestring));
    return element;
  }
}

export class DateRendererFactory extends RendererFactory<TimeRenderOptions> {
  public static readonly instance = new DateRendererFactory();

  activates(field: Field | Explore): boolean {
    return (
      field.hasParentExplore() &&
      field.isAtomicField() &&
      (field.type === AtomicFieldType.Date ||
        field.type === AtomicFieldType.Timestamp)
    );
  }

  create(
    document: Document,
    _styleDefaults: StyleDefaults,
    _rendererOptions: RendererOptions,
    _field: Field | Explore,
    _options: TimeRenderOptions,
    timezone?: string
  ): Renderer {
    return new HTMLDateRenderer(document, timezone);
  }

  get rendererName() {
    return 'time';
  }
}
