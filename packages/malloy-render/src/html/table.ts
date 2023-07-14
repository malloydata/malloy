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

import {DataColumn, Field, Tags} from '@malloydata/malloy';
import {StyleDefaults} from '../data_styles';
import {getDrillQuery} from '../drill';
import {ContainerRenderer} from './container';
import {HTMLNumberRenderer} from './number';
import {createDrillIcon, formatTitle, yieldTask} from './utils';
import {isFieldHidden} from '../tags_utils';

class PivotedField {
  constructor(readonly parentField: Field, readonly values: DataColumn[]) {}

  // TODO: this should hash.
  toString() {
    return `parentField:${this.parentField.name};values:${this.values
      // TODO: implement value.tostring.
      .map(v => v.string.value)
      .join(',')}`;
  }
}

class PivotedColumnField {
  constructor(readonly pivotedField: PivotedField, readonly field: Field) {}
  isPivotedColumnField(): this is PivotedColumnField {
    return this instanceof PivotedColumnField;
  }
}

type TableField = Field | PivotedColumnField;

export class HTMLTableRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    size: 'medium',
  };

  async render(table: DataColumn): Promise<HTMLElement> {
    if (!table.isArray() && !table.isRecord()) {
      throw new Error('Invalid type for Table Renderer');
    }

    const shouldTranspose = this.tagIsPresent(this.tags, 'transpose');

    if (shouldTranspose && table.field.intrinsicFields.length > 20) {
      throw new Error('Transpose limit of 20 columns exceeded.');
    }

    let rowIndex = 0;
    let columnIndex = 0;
    const cells: HTMLTableCellElement[][] = [];
    cells[rowIndex] = [];

    const columnFields: TableField[] = [];
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

      const shouldPivot =
        childRenderer instanceof HTMLTableRenderer &&
        this.tagIsPresent(childRenderer.tags, 'pivot');

      if (shouldPivot) {
        // TODO: START extract this.
        const pivotedFields: Map<string, PivotedField> = new Map();

        let dimensions: Field[] | undefined = undefined;
        let nonDimensions: Field[] = [];
        for (const row of table) {
          const dc = row.cell(field);
          if (!dc.isArray() && !dc.isRecord()) {
            throw new Error(`Cannot pivot field ${field.name}.`);
          }

          if (!dimensions) {
            const fieldi = dc.field;
            dimensions = fieldi.dimensions;
            nonDimensions = fieldi.allFields.filter(
              f => dimensions!.indexOf(f) < 0
            );
            if (nonDimensions.length === 0) {
              throw new Error(
                `Can not pivot ${field.name} since all of its fields are dimensions.`
              );
            }
          }

          for (const innerRow of dc) {
            const pivotedField = new PivotedField(
              field,
              dimensions.map(d => innerRow.cell(d))
            );

            const pfHash = pivotedField.toString();
            if (!pivotedFields[pfHash]) {
              pivotedFields.set(pfHash, pivotedField);
            }
          }
        }

        for (const pf of pivotedFields) {
          for (const nonDimension of nonDimensions) {
            columnFields.push(new PivotedColumnField(pf[1], nonDimension));

            // TODO: CLEAN THIS up
            const headerCell = this.document.createElement('th');
            headerCell.style.cssText = `
              padding: 8px;
              color: var(--malloy-title-color, #505050);
              border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
            `;

            name = `${pf[1].toString()} -- ${nonDimension.name}`;
            name = name.replace(/_/g, '_&#8203;');
            headerCell.innerHTML = name;
            cells[rowIndex][columnIndex] = headerCell;

            columnIndex++;
          }
        }

        // TODO: END extract this.
      } else {
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
        columnFields.push(field);
        columnIndex++;
      }
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
    try {
      for (const row of table) {
        cells[rowIndex] = [];
        columnIndex = 0;
        for (const field of columnFields) {
          if (field instanceof PivotedColumnField) {
            const childRenderer = this.childRenderers[
              field.pivotedField.parentField.name
            ] as HTMLTableRenderer;
            const childTableRecord = row.cell(field.pivotedField.parentField);
            await yieldTask();
            const pivotedCells = await childRenderer.generatePivotedCells(
              childTableRecord,
              field
            );
            const cellElement = this.document.createElement('td');
            if (pivotedCells.has(field.pivotedField.toString())) {
              throw new Error(
                `past this problem ${field.field.name} ${pivotedCells[
                  field.pivotedField.toString()
                ].has(field.field.name)}`
              );
              /*cellElement.appendChild(
                pivotedCells[field.pivotedField.toString()][field.field.name]
              );*/
            } else {
              const nv = this.document.createElement('span');
              nv.innerText = 'NV';
              cellElement.appendChild(nv);
            }
            cells[rowIndex][columnIndex] = cellElement;
            columnIndex++;
            // back
          } else {
            if (isFieldHidden(field)) {
              continue;
            }
            const childRenderer = this.childRenderers[field.name];
            const isNumeric = childRenderer instanceof HTMLNumberRenderer;
            await yieldTask();

            const rendered = await childRenderer.render(row.cell(field));
            const cellElement = this.document.createElement('td');
            cellElement.style.cssText = `
            padding: ${
              childRenderer instanceof HTMLTableRenderer ? '0' : '8px'
            };
            vertical-align: top;
            border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
            ${isNumeric ? 'text-align: right;' : ''}
          `;
            cellElement.appendChild(rendered);
            cells[rowIndex][columnIndex] = cellElement;
            columnIndex++;
          }
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
    } catch (e) {
      throw new Error(`${e.toString()} ${e.stack}`);
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

  async generatePivotedCells(
    table: DataColumn,
    pivotedColumnField: PivotedColumnField
  ): Promise<Map<string, Map<string, HTMLElement>>> {
    // TODO: hash result accordingly.
    const result: Map<string, Map<string, HTMLElement>> = new Map();
    if (!table.isArray() && !table.isRecord()) {
      throw new Error(`Could not pivot ${table.field.name}`);
    }

    const dimensions = table.field.dimensions;
    for (const row of table) {
      const pf = new PivotedField(
        table.field as Field,
        dimensions.map(f => row.cell(f.name))
      );
      // TODO: Consider using map instead.
      const renderedCells: Map<string, HTMLElement> = new Map();
      for (const nonDimension of table.field.allFields.filter(
        f => dimensions.indexOf(f) < 0
      )) {
        const childRenderer = this.childRenderers[nonDimension.name];
        // TODO: this should reuse logic above to render and add styles.
        await yieldTask();
        renderedCells.set(
          nonDimension.name,
          await childRenderer.render(row.cell(nonDimension.name))
        );
      }

      result.set(pf.toString(), renderedCells);
    }

    return result;
  }

  tagIsPresent(tags: Tags | undefined, tag: string): boolean {
    return tags ? tags.getMalloyTags().properties[tag] === true : false;
  }
}
