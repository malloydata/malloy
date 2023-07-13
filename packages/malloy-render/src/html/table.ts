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

import {DataColumn} from '@malloydata/malloy';
import {StyleDefaults} from '../data_styles';
import {getDrillQuery} from '../drill';
import {ContainerRenderer} from './container';
import {HTMLNumberRenderer} from './number';
import {createDrillIcon, formatTitle, yieldTask} from './utils';
import {isFieldHidden} from '../tags_utils';

export class HTMLTableRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    size: 'medium',
  };

  async render(table: DataColumn): Promise<HTMLElement> {
    if (!table.isArray() && !table.isRecord()) {
      throw new Error('Invalid type for Table Renderer');
    }

    const shouldTranspose = this.tags
      ? this.tags.getMalloyTags().properties['transpose'] === true
      : false;

    if (shouldTranspose && table.field.intrinsicFields.length > 20) {
      throw new Error('Transpose limit of 20 columns exceeded.');
    }

    let rowIndex = 0;
    let columnIndex = 0;
    const cells: HTMLTableCellElement[][] = [];
    cells[rowIndex] = [];
    for (const field of table.field.intrinsicFields) {
      if (isFieldHidden(field)) {
        continue;
      }

      let name = formatTitle(
        this.options,
        field,
        this.options.dataStyles[field.name],
        field.parentExplore.queryTimezone
      );
      const childRenderer = this.childRenderers[name];
      const isNumeric = childRenderer instanceof HTMLNumberRenderer;
      const headerCell = this.document.createElement('th');
      headerCell.style.cssText = `
        padding: 8px;
        color: var(--malloy-title-color, #505050);
        border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
        text-align: ${!isNumeric || shouldTranspose ? 'left' : 'right'};
      `;

      name = name.replace(/_/g, '_&#8203;');
      headerCell.innerHTML = name;
      cells[rowIndex][columnIndex] = headerCell;
      columnIndex++;
    }

    if (!shouldTranspose && this.options.isDrillingEnabled) {
      const drillHeader = this.document.createElement('th');
      drillHeader.style.cssText = `
        padding: 8px;
        color: var(--malloy-title-color, #505050);
        border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
        width: 25px;
      `;
      cells[rowIndex][columnIndex] = drillHeader;
      columnIndex++;
    }

    rowIndex++;
    for (const row of table) {
      cells[rowIndex] = [];
      columnIndex = 0;
      for (const field of table.field.intrinsicFields) {
        if (isFieldHidden(field)) {
          continue;
        }
        const childRenderer = this.childRenderers[field.name];
        const isNumeric = childRenderer instanceof HTMLNumberRenderer;
        await yieldTask();
        const rendered = await childRenderer.render(row.cell(field));
        const cellElement = this.document.createElement('td');
        cellElement.style.cssText = `
          padding: ${childRenderer instanceof HTMLTableRenderer ? '0' : '8px'};
          vertical-align: top;
          border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
          ${isNumeric || shouldTranspose ? 'text-align: right;' : ''}
        `;
        cellElement.appendChild(rendered);
        cells[rowIndex][columnIndex] = cellElement;
        columnIndex++;
      }

      // TODO(figutierrez): Deal with drill when transpose is on.
      if (!shouldTranspose && this.options.isDrillingEnabled) {
        const drillCell = this.document.createElement('td');
        const drillIcon = createDrillIcon(this.document);
        drillCell.appendChild(drillIcon);
        drillCell.style.cssText = `
          padding: 8px;
          vertical-align: top;
          border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
          width: 25px;
          cursor: pointer
        `;
        drillCell.onclick = () => {
          if (this.options.onDrill) {
            const {drillQuery, drillFilters} = getDrillQuery(row);
            this.options.onDrill(drillQuery, drillIcon, drillFilters);
          }
        };
        cells[rowIndex][columnIndex] = drillCell;
        columnIndex++;
      }

      rowIndex++;
    }

    const tableElement = this.document.createElement('table');
    let tableSection = this.document.createElement('thead');

    for (let row = 0; row < (shouldTranspose ? columnIndex : rowIndex); row++) {
      if (row === 1) {
        tableElement.appendChild(tableSection);
        tableSection = this.document.createElement('tbody');
      }
      const currentRow = this.document.createElement('tr');
      for (
        let column = 0;
        column < (shouldTranspose ? rowIndex : columnIndex);
        column++
      ) {
        currentRow.appendChild(
          shouldTranspose ? cells[column][row] : cells[row][column]
        );
      }
      tableSection.appendChild(currentRow);
    }
    tableElement.appendChild(tableSection);

    tableElement.style.cssText = `
      border: 1px solid var(--malloy-border-color, #eaeaea);
      vertical-align: top;
      border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
      border-collapse: collapse;
      width: 100%;
    `;
    return tableElement;
  }
}
