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

import {DataColumn, Field, SortableField, Tag} from '@malloydata/malloy';
import {StyleDefaults} from '../data_styles';
import {getDrillQuery} from '../drill';
import {ContainerRenderer} from './container';
import {HTMLNumberRenderer} from './number';
import {createDrillIcon, formatTitle, tagIsPresent, yieldTask} from './utils';
import {isFieldHidden} from '../tags_utils';
import {Renderer} from '../renderer';

class PivotedField {
  readonly key: string;
  readonly fieldValueMap: Map<string, DataColumn>;
  constructor(
    readonly parentField: Field,
    readonly values: DataColumn[],
    readonly span: number
  ) {
    this.key = JSON.stringify({
      parentField: this.parentField.name,
      values: this.values.map(v => (v.isScalar() ? v.key : '')),
    });
    this.fieldValueMap = new Map();
    for (const value of this.values) {
      this.fieldValueMap.set(value.field.name, value);
    }
  }
}

class PivotedColumnField {
  constructor(
    readonly pivotedField: PivotedField,
    readonly field: Field,
    readonly userDefinedPivotDimensions?: Array<string>
  ) {}
  isPivotedColumnField(): this is PivotedColumnField {
    return this instanceof PivotedColumnField;
  }
}

type TableField = Field | PivotedColumnField;

type SpannableCell = HTMLTableCellElement | undefined;

export class HTMLTableRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    size: 'medium',
  };

  async render(table: DataColumn): Promise<HTMLElement> {
    if (table.isNull()) {
      return this.document.createElement('span');
    }

    if (!table.isArray() && !table.isRecord()) {
      throw new Error('Invalid type for Table Renderer');
    }

    const shouldTranspose = tagIsPresent(this.tags, 'transpose');

    if (shouldTranspose && table.field.intrinsicFields.length > 20) {
      throw new Error('Transpose limit of 20 columns exceeded.');
    }

    let rowIndex = 0;
    let columnIndex = 0;
    let cells: SpannableCell[][] = [];
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
        tagIsPresent(childRenderer.tags, 'pivot');

      if (shouldPivot) {
        const dimensionsTag =
          childRenderer.tags?.tag?.properties?.['pivot'].properties?.[
            'dimensions'
          ];
        const userDefinedDimensions = dimensionsTag
          ? new Tag(dimensionsTag).array().map(dimension => dimension.text())
          : undefined;

        let dimensions: SortableField[] | undefined = undefined;
        let nonDimensions: SortableField[] = [];
        const pivotedFields: Map<string, PivotedField> = new Map();
        for (const row of table) {
          const dc = row.cell(field);
          if (dc.isNull()) {
            continue;
          }

          if (!dc.isArray() && !dc.isRecord()) {
            throw new Error(`Can not pivot field ${field.name}.`);
          }

          if (!dimensions) {
            const dimensionsResult = childRenderer.calculatePivotDimensions(
              dc,
              userDefinedDimensions
            );
            dimensions = dimensionsResult.dimensions;
            nonDimensions = dimensionsResult.nonDimensions;
          }

          for (const innerRow of dc) {
            const pivotedField = new PivotedField(
              field,
              dimensions.map(d => innerRow.cell(d.field)),
              nonDimensions.length
            );

            const pfKey = pivotedField.key;
            if (!pivotedFields[pfKey]) {
              pivotedFields.set(pfKey, pivotedField);
            }
          }
        }

        if (!dimensions) {
          throw new Error(`Could not pivot ${field.name}, no data found.`);
        }

        const sortedPivotedFields = Array.from(pivotedFields.values()).sort(
          (a, b) => {
            for (const d of dimensions!) {
              const aValue = a.fieldValueMap.get(d.field.name);
              const bValue = b.fieldValueMap.get(d.field.name);
              if (
                aValue?.isScalar() &&
                bValue?.isScalar() &&
                typeof aValue === typeof bValue
              ) {
                if (aValue.isNull()) {
                  if (bValue.isNull()) {
                    return 0;
                  } else {
                    return 1;
                  }
                } else if (bValue.isNull()) {
                  return -1;
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const compValue = aValue.compareTo(bValue as any);
                if (compValue !== 0) {
                  return d.dir !== 'desc' ? compValue : -compValue;
                }
              }
            }

            return 0;
          }
        );

        for (const pf of sortedPivotedFields) {
          for (const nonDimension of nonDimensions) {
            columnFields.push(
              new PivotedColumnField(
                pf,
                nonDimension.field,
                userDefinedDimensions
              )
            );
            cells[rowIndex][columnIndex] = childRenderer.createHeaderCell(
              nonDimension.field,
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

    if (pivotDepth > 0 && columnFields.length > 30) {
      throw new Error('Pivot limit of 30 columns exceeded.');
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
    const pivotHeaderCells: SpannableCell[][] = [];
    for (let r = 0; r < pivotDepth; r++) {
      const row: SpannableCell[] = [];
      let lastPivotedColumnHash: string | null = null;
      for (const field of columnFields) {
        if (field instanceof PivotedColumnField) {
          const pfKey = field.pivotedField.key;
          const valueIndex = field.pivotedField.values.length - pivotDepth + r;
          if (valueIndex < 0) {
            row.push(this.createEmptyHeaderCell());
          } else if (lastPivotedColumnHash !== pfKey) {
            const headerCell = this.document.createElement('th');
            if (!shouldTranspose) {
              headerCell.colSpan = field.pivotedField.span;
            } else {
              headerCell.rowSpan = field.pivotedField.span;
            }

            headerCell.style.cssText = `
                padding: 8px;
                color: var(--malloy-title-color, #505050);
                border-bottom: 1px solid var(--malloy-border-color, #eaeaeb);
                text-align: left;
              `;
            const value = field.pivotedField.values[valueIndex];
            headerCell.appendChild(
              this.document.createTextNode(`${value.field.name}: `)
            );
            headerCell.appendChild(
              await (
                this.childRenderers[
                  field.pivotedField.parentField.name
                ] as HTMLTableRenderer
              ).renderChild(value)
            );
            lastPivotedColumnHash = pfKey;
            row.push(headerCell);
          } else {
            row.push(undefined);
          }
        } else {
          row.push(this.createEmptyHeaderCell());
        }
      }

      pivotHeaderCells.push(row);
      rowIndex++;
    }

    cells = [...pivotHeaderCells, ...cells];

    for (const row of table) {
      cells[rowIndex] = [];
      columnIndex = 0;
      let currentPivotedFieldKey = '';
      let pivotedCells: Map<
        string,
        Map<string, HTMLTableCellElement>
      > = new Map();
      for (const field of columnFields) {
        if (field instanceof PivotedColumnField) {
          const childRenderer = this.childRenderers[
            field.pivotedField.parentField.name
          ] as HTMLTableRenderer;
          const childTableRecord = row.cell(field.pivotedField.parentField);
          await yieldTask();
          if (field.pivotedField.key !== currentPivotedFieldKey) {
            pivotedCells = await childRenderer.generatePivotedCells(
              childTableRecord,
              shouldTranspose,
              field.userDefinedPivotDimensions
            );
            currentPivotedFieldKey = field.pivotedField.key;
          }
          const pfKey = field.pivotedField.key;
          if (
            pivotedCells.has(pfKey) &&
            pivotedCells.get(pfKey)?.has(field.field.name)
          ) {
            cells[rowIndex][columnIndex] = pivotedCells
              .get(pfKey)!
              .get(field.field.name)!;
          } else {
            cells[rowIndex][columnIndex] = childRenderer.generateNoValueCell(
              field.field,
              shouldTranspose
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
            row.cell(field),
            shouldTranspose
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
          cursor: pointer;
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
        const cell = shouldTranspose ? cells[column][row] : cells[row][column];
        if (cell) {
          currentRow.appendChild(cell);
        }
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

  calculatePivotDimensions(
    table: DataColumn,
    userSpecifiedDimensions?: Array<string>
  ): {
    dimensions: SortableField[];
    nonDimensions: SortableField[];
  } {
    if (!table.isArray() && !table.isRecord()) {
      throw new Error(`Could not pivot ${table.field.name}`);
    }
    let dimensions: SortableField[] | undefined = undefined;
    if (userSpecifiedDimensions) {
      dimensions = table.field.allFieldsWithOrder.filter(
        f => userSpecifiedDimensions.indexOf(f.field.name) >= 0
      );
      if (dimensions.length !== userSpecifiedDimensions.length) {
        for (const dim of userSpecifiedDimensions) {
          if (
            table.field.allFieldsWithOrder.filter(f => f.field.name === dim)
              .length === 0
          ) {
            throw new Error(
              `Could not pivot ${table.field.name} since ${dim} is not a valid field.`
            );
          }
        }
      }
    } else {
      dimensions = table.field.dimensions;
    }

    const nonDimensions = table.field.allFieldsWithOrder.filter(
      f => dimensions!.indexOf(f) < 0
    );
    if (nonDimensions.length === 0) {
      throw new Error(
        `Can not pivot ${table.field.name} since all of its fields are dimensions.`
      );
    }

    return {dimensions, nonDimensions};
  }

  async generatePivotedCells(
    table: DataColumn,
    shouldTranspose: boolean,
    userSpecifiedDimensions?: Array<string>
  ): Promise<Map<string, Map<string, HTMLTableCellElement>>> {
    const result: Map<string, Map<string, HTMLTableCellElement>> = new Map();

    if (table.isNull()) {
      return result;
    }

    if (!table.isArray() && !table.isRecord()) {
      throw new Error(`Could not pivot ${table.field.name}`);
    }

    const {dimensions, nonDimensions} = this.calculatePivotDimensions(
      table,
      userSpecifiedDimensions
    );
    for (const row of table) {
      const pf = new PivotedField(
        table.field as Field,
        dimensions.map(f => row.cell(f.field.name)),
        nonDimensions.length
      );
      const renderedCells: Map<string, HTMLTableCellElement> = new Map();
      for (const nonDimension of table.field.allFieldsWithOrder.filter(
        f => dimensions.indexOf(f) < 0
      )) {
        const childRenderer = this.childRenderers[nonDimension.field.name];
        renderedCells.set(
          nonDimension.field.name,
          await this.createCellAndRender(
            childRenderer,
            row.cell(nonDimension.field.name),
            shouldTranspose
          )
        );
      }

      if (result.has(pf.key)) {
        throw new Error(
          `Can not pivot ${table.field.name} dimensions lead to non unique pivots.`
        );
      }
      result.set(pf.key, renderedCells);
    }
    return result;
  }

  generateNoValueCell(
    field: Field,
    shouldTranspose: boolean
  ): HTMLTableCellElement {
    const cell = this.createCell(
      this.childRenderers[field.name],
      shouldTranspose
    );
    cell.innerHTML = '-';
    return cell;
  }

  async createCellAndRender(
    childRenderer: Renderer,
    value: DataColumn,
    shouldTranspose: boolean
  ): Promise<HTMLTableCellElement> {
    const cell = this.createCell(childRenderer, shouldTranspose);
    cell.appendChild(await childRenderer.render(value));
    return cell;
  }

  createEmptyHeaderCell(): HTMLTableCellElement {
    const headerCell = this.document.createElement('th');
    headerCell.style.cssText = `
      padding: 8px;
      color: var(--malloy-title-color, #505050);
      border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
    `;
    return headerCell;
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
      text-align: ${isNumeric || shouldTranspose ? 'right' : 'left'};
    `;

    name = name.replace(/_/g, '_&#8203;');
    headerCell.innerHTML = name;
    return headerCell;
  }

  createCell(
    childRenderer: Renderer,
    shouldTranspose: boolean
  ): HTMLTableCellElement {
    const isNumeric = childRenderer instanceof HTMLNumberRenderer;
    yieldTask();
    const cellElement = this.document.createElement('td');
    cellElement.style.cssText = `
      padding: ${childRenderer instanceof HTMLTableRenderer ? '0' : '8px'};
      vertical-align: top;
      border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
      ${isNumeric || shouldTranspose ? 'text-align: right;' : ''}
    `;

    return cellElement;
  }

  async renderChild(value: DataColumn) {
    return this.childRenderers[value.field.name].render(value);
  }
}
