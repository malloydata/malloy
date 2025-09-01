import type * as Malloy from '@malloydata/malloy-interfaces';
import type {
  ArrayField,
  RecordField,
  RepeatedRecordField,
  RootField,
} from '../fields';
import {Cell, type CellValue} from '.';
import {CellBase} from './base';
import type {NestCell} from '.';

export class ArrayCell extends CellBase {
  public readonly values: Cell[] = [];
  constructor(
    public readonly cell: Malloy.CellWithArrayCell,
    public readonly field: ArrayField,
    public readonly parent: NestCell | undefined
  ) {
    super(cell, field, parent);
    // Use the pre-created element field from the ArrayField
    for (const value of this.cell.array_value) {
      this.values.push(Cell.from(value, this.field.elementField, this));
    }
  }

  get value() {
    return this.values;
  }
}

export class RepeatedRecordCell extends CellBase {
  public readonly rows: RecordCell[] = [];
  public readonly fieldValueSets: Map<string, Set<CellValue>> = new Map();

  constructor(
    public readonly cell: Malloy.CellWithArrayCell,
    public readonly field: RepeatedRecordField,
    public readonly parent: NestCell | undefined
  ) {
    super(cell, field, parent);

    // Create RecordCells directly from the array values
    for (let i = 0; i < this.cell.array_value.length; i++) {
      const recordValue = this.cell.array_value[i];
      if (!('record_value' in recordValue)) {
        throw new Error('Expected record cell in RepeatedRecordCell');
      }
      // No new fields are created. We just access the cached one from the schema.
      const recordCell = new RecordCell(
        recordValue,
        this.field.nestedRecordField,
        this
      );
      this.rows.push(recordCell);
    }

    // First, create cells for all the rows
    for (const row of this.rows) {
      for (const column of row.columns) {
        const field = column.field;
        let valueSet = this.fieldValueSets.get(field.name);
        if (valueSet === undefined) {
          valueSet = new Set();
          this.fieldValueSets.set(field.name, valueSet);
        }
        valueSet.add(column.value);
      }
    }
    for (const [field, set] of this.fieldValueSets.entries()) {
      this.field.registerValueSetSize(field, set.size);
    }

    // Run plugins for this field
    const fieldPlugins = this.field.getPlugins();
    for (const plugin of fieldPlugins) {
      plugin.processData?.(this.field, this);
    }
  }

  get value() {
    return this.rows;
  }

  get values() {
    return this.rows;
  }
}

export class RootCell extends RepeatedRecordCell {
  constructor(
    public readonly cell: Malloy.CellWithArrayCell,
    public readonly field: RootField
  ) {
    super(cell, field, undefined);
  }
}

export class RecordCell extends CellBase {
  public cells: Record<string, Cell> = {};
  constructor(
    public readonly cell: Malloy.CellWithRecordCell,
    public readonly field: RecordField,
    public readonly parent: NestCell | undefined
  ) {
    super(cell, field, parent);
    for (let i = 0; i < field.fields.length; i++) {
      const childField = field.fields[i];
      const childCell = Cell.from(cell.record_value[i], childField, this);
      this.cells[childField.name] = childCell;
    }
  }

  public get rows(): RecordCell[] {
    return [this];
  }

  get value() {
    return this.cells;
  }

  column(name: string): Cell {
    return this.cells[name];
  }

  get columns(): Cell[] {
    return this.field.fields.map(f => this.column(f.name));
  }

  allCellValues(): Record<string, CellValue> {
    return Object.fromEntries(
      Object.entries(this.cells).map(([name, cell]) => [name, cell.value])
    );
  }

  cellAtPath(path: string[]): Cell {
    if (path.length === 0) {
      return this.asCell();
    } else {
      const [head, ...rest] = path;
      const cell = this.cells[head];
      if (cell === undefined) {
        throw new Error(`No such column ${head} in ${this.field.path}`);
      }
      return cell.cellAtPath(rest);
    }
  }
}
