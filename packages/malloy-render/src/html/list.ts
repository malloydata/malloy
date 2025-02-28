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

import {StyleDefaults} from './data_styles';
import {ContainerRenderer} from './container';
import {createErrorElement, yieldTask} from './utils';
import * as Malloy from '@malloydata/malloy-interfaces';
import {
  getCell,
  getNestFields,
  isNest,
  NestFieldInfo,
  tagFor,
} from '../component/util';

export class HTMLListRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    size: 'small',
  };

  getValueField(struct: NestFieldInfo): Malloy.DimensionInfo {
    // Get the first non-hidden field as the value
    return getNestFields(struct).filter(field => {
      const tag = tagFor(field);
      return !tag.has('hidden');
    })[0];
  }

  getDetailField(_struct: NestFieldInfo): Malloy.DimensionInfo | undefined {
    return undefined;
  }

  async render(
    table: Malloy.Cell,
    field: Malloy.DimensionInfo
  ): Promise<HTMLElement> {
    if (table.kind !== 'array_cell' || !isNest(field)) {
      return createErrorElement(
        this.document,
        'Invalid data for chart renderer.'
      );
    }
    if (table.array_value.length === 0) {
      return this.document.createElement('span');
    }

    const valueField = this.getValueField(field);
    const detailField = this.getDetailField(field);

    const element = this.document.createElement('span');
    let isFirst = true;
    for (const rowCell of table.array_value) {
      if (rowCell.kind !== 'record_cell') {
        throw new Error('Expected to be a record cell');
      }
      const row = rowCell.record_value;
      if (!isFirst) {
        element.appendChild(this.document.createTextNode(', '));
      }
      isFirst = false;
      const childRenderer = this.childRenderers[valueField.name];
      const rendered = await childRenderer.render(
        getCell(field, row, valueField.name),
        valueField
      );
      element.appendChild(rendered);
      if (detailField) {
        const childRenderer = this.childRenderers[detailField.name];
        await yieldTask();
        const rendered = await childRenderer.render(
          getCell(field, row, detailField.name),
          detailField
        );
        element.appendChild(this.document.createTextNode('('));
        element.appendChild(rendered);
        element.appendChild(this.document.createTextNode(')'));
      }
    }
    return element;
  }
}
