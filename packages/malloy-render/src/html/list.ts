/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import type {StyleDefaults} from './data_styles';
import {ContainerRenderer} from './container';
import {createErrorElement, yieldTask} from './utils';
import type {Cell, Field, RecordOrRepeatedRecordField} from '../data_tree';

export class HTMLListRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    size: 'small',
  };

  getValueField(struct: RecordOrRepeatedRecordField): Field {
    // Get the first non-hidden field as the value
    return struct.fields.filter(field => !field.isHidden())[0];
  }

  getDetailField(_struct: RecordOrRepeatedRecordField): Field | undefined {
    return undefined;
  }

  async render(table: Cell): Promise<HTMLElement> {
    if (!table.isRecordOrRepeatedRecord()) {
      return createErrorElement(
        this.document,
        'Invalid data for list renderer.'
      );
    }
    if (table.rows.length === 0) {
      return this.document.createElement('span');
    }

    const valueField = this.getValueField(table.field);
    const detailField = this.getDetailField(table.field);

    const element = this.document.createElement('span');
    let isFirst = true;
    for (const row of table.rows) {
      if (!isFirst) {
        element.appendChild(this.document.createTextNode(', '));
      }
      isFirst = false;
      const childRenderer = this.childRenderers[valueField.name];
      const rendered = await childRenderer.render(row.column(valueField.name));
      element.appendChild(rendered);
      if (detailField) {
        const childRenderer = this.childRenderers[detailField.name];
        await yieldTask();
        const rendered = await childRenderer.render(
          row.column(detailField.name)
        );
        element.appendChild(this.document.createTextNode('('));
        element.appendChild(rendered);
        element.appendChild(this.document.createTextNode(')'));
      }
    }
    return element;
  }
}
