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

import type {StyleDefaults} from './data_styles';
import {ContainerRenderer} from './container';
import {HTMLNumberRenderer} from './number';
import {createDrillIcon, formatTitle, yieldTask} from './utils';
import type {ChildRenderers, Renderer} from './renderer';
import type {
  Cell,
  Field,
  RecordCell,
  RecordField,
  RecordOrRepeatedRecordCell,
  RecordOrRepeatedRecordField,
  SortableField,
} from '../data_tree';

class PivotedField {
  readonly key: string;
  readonly fieldValueMap: Map<string, Cell>;
  constructor(
    readonly parentField: RecordOrRepeatedRecordField,
    readonly values: Cell[],
    readonly span: number
  ) {
    this.key = JSON.stringify({
      parentField: this.parentField.name,
      values: this.values.map(v => (v.field.isAtomic() ? String(v.value) : '')),
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

class FlattenedColumnField {
  constructor(
    readonly flattenedField: RecordField,
    readonly field: Field,
    readonly name: string
  ) {}

  isFlattenedColumnField(): this is FlattenedColumnField {
    return this instanceof FlattenedColumnField;
  }

  getChildRenderer(childRenderers: ChildRenderers) {
    const baseRenderer = childRenderers[this.flattenedField.name];
    if (baseRenderer instanceof HTMLTableRenderer) {
      return baseRenderer.childRenderers[this.field.name];
    } else {
      throw Error(
        'Could not render flattened table. `# flatten` only supports nests.'
      );
    }
  }

  getValue(row: RecordCell) {
    const parentRecord = row.column(this.flattenedField.name);
    if (parentRecord.isRecord()) return parentRecord.column(this.field.name);
    else
      throw Error(
        'Cannot find nested record within flattened field. `# flatten` only supports nests with no group_bys.'
      );
  }
}

type TableField = Field | PivotedColumnField | FlattenedColumnField;
type NonDimension = SortableField & {flattenedField?: FlattenedColumnField};

type SpannableCell = HTMLTableCellElement | undefined;

function shouldFlattenField(field: Field) {
  return field.isRecord() && field.tag.has('flatten');
}

export class HTMLTableRenderer extends ContainerRenderer {
  protected childrenStyleDefaults: StyleDefaults = {
    size: 'medium',
  };

  async render(table: Cell): Promise<HTMLElement> {
    if (table.isNull()) {
      return this.document.createElement('span');
    }

    if (!table.isRecordOrRepeatedRecord()) {
      throw new Error('Invalid type for Table Renderer');
    }

    const shouldTranspose = this.tagged.has('transpose');

    const fields = table.field.fields;

    if (shouldTranspose && fields.length > 20) {
      throw new Error('Transpose limit of 20 columns exceeded.');
    }

    let rowIndex = 0;
    let columnIndex = 0;
    let cells: SpannableCell[][] = [];
    cells[rowIndex] = [];

    const columnFields: TableField[] = [];
    let pivotDepth = 0;
    for (const field of fields) {
      if (field.isHidden()) {
        continue;
      }

      const childRenderer = this.childRenderers[field.name];

      const shouldPivot =
        childRenderer instanceof HTMLTableRenderer &&
        childRenderer.tagged.has('pivot');

      if (shouldPivot) {
        const userDefinedDimensions = childRenderer.tagged.textArray(
          'pivot',
          'dimensions'
        );

        let dimensions: SortableField[] | undefined = undefined;
        let nonDimensions: NonDimension[] = [];
        const pivotedFields: Map<string, PivotedField> = new Map();
        for (const row of table.rows) {
          const dc = row.column(field.name);
          if (dc.isNull()) {
            continue;
          }

          if (!dc.isRecordOrRepeatedRecord()) {
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

          for (const innerRow of dc.rows) {
            const pivotedField = new PivotedField(
              dc.field,
              dimensions.map(d => innerRow.column(d.field.name)),
              nonDimensions.length
            );

            const pfKey = pivotedField.key;
            if (!pivotedFields.get(pfKey)) {
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
                aValue?.field.isAtomic() &&
                bValue?.field.isAtomic() &&
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
              shouldTranspose,
              {
                name: nonDimension.flattenedField?.name,
                childRenderer: nonDimension.flattenedField?.getChildRenderer(
                  childRenderer.childRenderers
                ),
              }
            );
            columnIndex++;
          }
        }
        pivotDepth = Math.max(pivotDepth, dimensions!.length);
      } else if (shouldFlattenField(field)) {
        const parentField = field as RecordField;
        const parentFieldFields = parentField.fields;
        const flattenedFields = parentFieldFields.map(
          f =>
            new FlattenedColumnField(
              parentField,
              f,
              `${parentField.name} ${f.name}`
            )
        );
        for (const flatField of flattenedFields) {
          cells[rowIndex][columnIndex] = this.createHeaderCell(
            flatField.field,
            shouldTranspose,
            {
              name: flatField.name,
              childRenderer: flatField.getChildRenderer(this.childRenderers),
            }
          );
          columnFields.push(flatField);
          columnIndex++;
        }
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

    for (const row of table.rows) {
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
          const childTableRecord = row.column(
            field.pivotedField.parentField.name
          );
          await yieldTask();
          if (!childTableRecord.isRecordOrRepeatedRecord()) {
            throw new Error(
              'Expected childTableRecord to be a record or repeated record'
            );
          }
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
        } else if (field instanceof FlattenedColumnField) {
          cells[rowIndex][columnIndex] = await this.createCellAndRender(
            field.getChildRenderer(this.childRenderers),
            field.getValue(row),
            shouldTranspose
          );
          columnIndex++;
        } else {
          if (field.isHidden()) {
            continue;
          }
          const childRenderer = this.childRenderers[field.name];
          cells[rowIndex][columnIndex] = await this.createCellAndRender(
            childRenderer,
            row.column(field.name),
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
          padding: 2px;
          vertical-align: top;
          border-bottom: 1px solid var(--malloy-border-color, #eaeaea);
          width: 25px;
          cursor: pointer;
        `;
        drillCell.onclick = () => {
          if (this.options.onDrill) {
            const drillQuery = row.getDrillQuery();
            const drillFilters = row.getDrillExpressions();
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
    table: RecordOrRepeatedRecordCell,
    userSpecifiedDimensions?: Array<string>
  ): {
    dimensions: SortableField[];
    nonDimensions: NonDimension[];
  } {
    let dimensions: SortableField[] | undefined = undefined;
    if (userSpecifiedDimensions) {
      dimensions = table.field.fieldsWithOrder.filter(
        f => userSpecifiedDimensions.indexOf(f.field.name) >= 0
      );
      if (dimensions.length !== userSpecifiedDimensions.length) {
        for (const dim of userSpecifiedDimensions) {
          if (
            table.field.fieldsWithOrder.filter(f => f.field.name === dim)
              .length === 0
          ) {
            throw new Error(
              `Could not pivot ${table.field.name} since ${dim} is not a valid field.`
            );
          }
        }
      }
    } else {
      dimensions = table.field.fieldsWithOrder.filter(
        f => f.field.isAtomic() && f.field.wasDimension()
      );
    }

    const nonDimensions: NonDimension[] = [];
    for (const f of table.field.fieldsWithOrder) {
      if (dimensions!.indexOf(f) >= 0) continue;
      if (shouldFlattenField(f.field)) {
        const recordField = f.field as RecordField;
        const nestedFields = recordField.fieldsWithOrder.map(nf => ({
          dir: nf.dir,
          field: nf.field,
          flattenedField: new FlattenedColumnField(
            recordField,
            nf.field,
            `${f.field.name} ${nf.field.name}`
          ),
        }));

        nonDimensions.push(...nestedFields);
      } else {
        nonDimensions.push(f);
      }
    }

    if (nonDimensions.length === 0) {
      throw new Error(
        `Can not pivot ${table.field.name} since all of its fields are dimensions.`
      );
    }

    return {dimensions, nonDimensions};
  }

  async generatePivotedCells(
    table: RecordOrRepeatedRecordCell,
    shouldTranspose: boolean,
    userSpecifiedDimensions?: Array<string>
  ): Promise<Map<string, Map<string, HTMLTableCellElement>>> {
    const result: Map<string, Map<string, HTMLTableCellElement>> = new Map();

    if (table.isNull()) {
      return result;
    }

    const {dimensions, nonDimensions} = this.calculatePivotDimensions(
      table,
      userSpecifiedDimensions
    );

    for (const row of table.rows) {
      const pf = new PivotedField(
        table.field,
        dimensions.map(f => row.column(f.field.name)),
        nonDimensions.length
      );
      const renderedCells: Map<string, HTMLTableCellElement> = new Map();
      for (const nonDimension of nonDimensions) {
        let childRenderer;
        let value;
        if (nonDimension.flattenedField) {
          childRenderer = nonDimension.flattenedField.getChildRenderer(
            this.childRenderers
          );
          value = nonDimension.flattenedField.getValue(row);
        } else {
          childRenderer = this.childRenderers[nonDimension.field.name];
          value = row.column(nonDimension.field.name);
        }

        renderedCells.set(
          nonDimension.field.name,
          await this.createCellAndRender(childRenderer, value, shouldTranspose)
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
    cell.textContent = '-';
    return cell;
  }

  async createCellAndRender(
    childRenderer: Renderer,
    value: Cell,
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
    shouldTranspose: boolean,
    override: {
      name?: string;
      childRenderer?: Renderer;
    } = {}
  ): HTMLTableCellElement {
    let name =
      override.name ??
      formatTitle(
        this.options,
        field,
        this.options.dataStyles[field.name],
        field.root().queryTimezone
      );

    const childRenderer =
      override.childRenderer ?? this.childRenderers[field.name];
    const isNumeric = childRenderer instanceof HTMLNumberRenderer;
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

  async renderChild(value: Cell) {
    return this.childRenderers[value.field.name].render(value);
  }
}
