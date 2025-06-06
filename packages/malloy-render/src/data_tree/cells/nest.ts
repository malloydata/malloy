import type * as Malloy from '@malloydata/malloy-interfaces';
import type {
  ArrayField,
  RecordField,
  RepeatedRecordField,
  RootField,
} from '../fields';
import type {RenderPlugin} from '../plugins';
import type {FieldRegistry} from '../types';
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
    for (const value of this.cell.array_value) {
      this.values.push(Cell.from(value, field.eachField, this));
    }
  }

  get value() {
    return this.values;
  }
}

export class RepeatedRecordCell extends ArrayCell {
  public readonly rows: RecordCell[];
  public readonly fieldValueSets: Map<string, Set<CellValue>> = new Map();
  private plugins: RenderPlugin[];
  private registry?: FieldRegistry;

  constructor(
    public readonly cell: Malloy.CellWithArrayCell,
    public readonly field: RepeatedRecordField,
    public readonly parent: NestCell | undefined,
    plugins: RenderPlugin[] = [],
    registry?: FieldRegistry
  ) {
    super(cell, field, parent);
    this.plugins = plugins;
    this.registry = registry;
    this.rows = this.values as RecordCell[];

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
      plugin.processData(this.field, this);
    }
  }

  get value() {
    return this.rows;
  }
}

export class RootCell extends RepeatedRecordCell {
  constructor(
    public readonly cell: Malloy.CellWithArrayCell,
    public readonly field: RootField,
    plugins: RenderPlugin[] = [],
    registry?: FieldRegistry
  ) {
    super(cell, field, undefined, plugins, registry);
  }
}

export class RecordCell extends CellBase {
  public readonly cells: Record<string, Cell> = {};
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
