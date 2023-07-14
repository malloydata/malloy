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
import {Renderer} from '../renderer';

class PivotedField {
  readonly key: string;
  constructor(readonly parentField: Field, readonly values: DataColumn[]) {
    this.key = JSON.stringify({
      parentField: this.parentField.name,
      values: this.values.filter(v => (v.isScalar() ? v.key : '')),
    });
  }
}

class PivotedColumnField {
  constructor(readonly pivotedField: PivotedField, readonly field: Field) {}
  isPivotedColumnField(): this is PivotedColumnField {
    return this instanceof PivotedColumnField;
  }
}

type TableField = Field | PivotedColumnField;

type RendereableDataRecord = {
  childRenderer: Renderer;
  dataRecord: DataColumn;
};

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
    let cells: HTMLTableCellElement[][] = [];
    cells[rowIndex] = [];

    const columnFields: TableField[] = [];
    let pivotDepth = 0;
    for (const field of table.field.intrinsicFields) {
      if (isFieldHidden(field)) {
        continue;
      }

      const childRenderer = this.childRenderers[field.name];
      const shouldPivot =
        childRenderer instanceof HTMLTableRenderer &&
        this.tagIsPresent(childRenderer.tags, 'pivot');

      if (shouldPivot) {
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

            const pfKey = pivotedField.key;
            if (!pivotedFields[pfKey]) {
              pivotedFields.set(pfKey, pivotedField);
            }
          }
        }

        for (const pf of pivotedFields) {
          for (const nonDimension of nonDimensions) {
            columnFields.push(new PivotedColumnField(pf[1], nonDimension));
            cells[rowIndex][columnIndex] = childRenderer.createHeaderCell(
              nonDimension,
              shouldTranspose
            );
            columnIndex++;
          }
        }

        pivotDepth = Math.max(pivotDepth, dimensions!.length);
      } else {
        cells[rowIndex][columnIndex] = this.createHeaderCell(
          field,
          shouldTranspose
        );
        columnFields.push(field);
        columnIndex++;
      }
    }

    if (columnFields.length > 20) {
      throw new Error('Pivot limit of 20 columns exceeded.');
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

    const pivotHeaderCells: HTMLTableCellElement[][] = [];
    for (let r = 0; r < pivotDepth; r++) {
      const row: HTMLTableCellElement[] = [];
      let lastPivotedColumnHash: string | null = null;
      for (const field of columnFields) {
        if (field instanceof PivotedColumnField) {
          const headerCell = this.document.createElement('th');
          headerCell.style.cssText = `
              padding: 8px;
              color: var(--malloy-title-color, #505050);
              border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
            `;

          const pfKey = field.pivotedField.key;
          const valueIndex = field.pivotedField.values.length - pivotDepth + r;
          if (lastPivotedColumnHash !== pfKey && valueIndex >= 0) {
            const value = field.pivotedField.values[valueIndex];
            headerCell.appendChild(
              await (
                this.childRenderers[
                  field.pivotedField.parentField.name
                ] as HTMLTableRenderer
              ).renderChild(value)
            );
            lastPivotedColumnHash = pfKey;
          }

          row.push(headerCell);
        } else {
          const headerCell = this.document.createElement('th');
          headerCell.style.cssText = `
          padding: 8px;
          color: var(--malloy-title-color, #505050);
          border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
        `;
          row.push(headerCell);
        }
      }

      pivotHeaderCells.push(row);
      rowIndex++;
    }

    cells = [...pivotHeaderCells, ...cells];

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
              childTableRecord
            );
            const pfKey = field.pivotedField.key;
            if (
              pivotedCells.has(pfKey) &&
              pivotedCells.get(pfKey)?.has(field.field.name)
            ) {
              const record = pivotedCells.get(pfKey)!.get(field.field.name)!;
              cells[rowIndex][columnIndex] = await this.createCellAndRender(
                record.childRenderer,
                record.dataRecord
              );
            } else {
              cells[rowIndex][columnIndex] = childRenderer.generateNoValueCell(
                childTableRecord,
                field.field
              );
            }
            columnIndex++;
            // back
          } else {
            if (isFieldHidden(field)) {
              continue;
            }
            const childRenderer = this.childRenderers[field.name];
            cells[rowIndex][columnIndex] = await this.createCellAndRender(
              childRenderer,
              row.cell(field)
            );
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
      if (row === 1 + pivotDepth) {
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

  private pivotedCells:
    | Map<string, Map<string, RendereableDataRecord>>
    | undefined;

  async generatePivotedCells(
    table: DataColumn
  ): Promise<Map<string, Map<string, RendereableDataRecord>>> {
    /*if (this.pivotedCells) {
      return this.pivotedCells;
    }*/
    const result: Map<string, Map<string, RendereableDataRecord>> = new Map();
    if (!table.isArray() && !table.isRecord()) {
      throw new Error(`Could not pivot ${table.field.name}`);
    }

    const dimensions = table.field.dimensions;
    for (const row of table) {
      const pf = new PivotedField(
        table.field as Field,
        dimensions.map(f => row.cell(f.name))
      );
      const renderedCells: Map<string, RendereableDataRecord> = new Map();
      for (const nonDimension of table.field.allFields.filter(
        f => dimensions.indexOf(f) < 0
      )) {
        const childRenderer = this.childRenderers[nonDimension.name];
        renderedCells.set(nonDimension.name, {
          childRenderer,
          dataRecord: row.cell(nonDimension.name),
        });
      }

      result.set(pf.key, renderedCells);
    }

    this.pivotedCells = result;
    return result;
  }

  generateNoValueCell(table: DataColumn, field: Field): HTMLTableCellElement {
    if (!table.isArray() && !table.isRecord()) {
      throw new Error(`Could not pivot ${table.field.name}`);
    }

    const cell = this.createCell(this.childRenderers[field.name]);
    cell.innerHTML = '-';
    return cell;
  }

  tagIsPresent(tags: Tags | undefined, tag: string): boolean {
    return tags ? tags.getMalloyTags().properties[tag] === true : false;
  }

  async createCellAndRender(
    childRenderer: Renderer,
    value: DataColumn
  ): Promise<HTMLTableCellElement> {
    const cell = this.createCell(childRenderer);
    cell.appendChild(await childRenderer.render(value));
    return cell;
  }

  createHeaderCell(
    field: Field,
    shouldTranspose: boolean
  ): HTMLTableCellElement {
    let name = formatTitle(
      this.options,
      field,
      this.options.dataStyles[field.name],
      field.parentExplore.queryTimezone
    );

    const isNumeric =
      this.childRenderers[field.name] instanceof HTMLNumberRenderer;
    const headerCell = this.document.createElement('th');
    headerCell.style.cssText = `
      padding: 8px;
      color: var(--malloy-title-color, #505050);
      border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
      text-align: ${!isNumeric || shouldTranspose ? 'left' : 'right'};
    `;

    name = name.replace(/_/g, '_&#8203;');
    headerCell.innerHTML = name;
    return headerCell;
  }

  createCell(childRenderer: Renderer): HTMLTableCellElement {
    const isNumeric = childRenderer instanceof HTMLNumberRenderer;
    yieldTask();
    const cellElement = this.document.createElement('td');
    cellElement.style.cssText = `
      padding: ${childRenderer instanceof HTMLTableRenderer ? '0' : '8px'};
      vertical-align: top;
      border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
      ${isNumeric ? 'text-align: right;' : ''}
    `;

    return cellElement;
  }

  async renderChild(value: DataColumn) {
    return this.childRenderers[value.field.name].render(value);
  }
}
