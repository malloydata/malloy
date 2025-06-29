import type * as Malloy from '@malloydata/malloy-interfaces';
import type {Cell, NestCell, RecordCell} from '.';
import type {Field} from '../fields';
import {
  canDrill,
  getDrillEntries,
  getDrillExpressions,
  getDrillQueryMalloy,
  getStableDrillClauses,
  getStableDrillQuery,
  getStableDrillQueryMalloy,
} from '../drilling';
import {
  ArrayCell,
  BooleanCell,
  DateCell,
  JSONCell,
  NullCell,
  NumberCell,
  RecordCell as RecordCellType,
  RepeatedRecordCell,
  SQLNativeCell,
  StringCell,
  TimestampCell,
  type TimeCell,
  type RecordOrRepeatedRecordCell,
  type CellValue,
} from '.';
import type {DrillEntry} from '../types';

export abstract class CellBase {
  constructor(
    public readonly cell: Malloy.Cell,
    public readonly field: Field,
    public readonly parent: NestCell | undefined
  ) {}

  get literalValue(): Malloy.LiteralValue | undefined {
    return undefined;
  }

  abstract get value(): CellValue;

  isNull(): this is NullCell {
    return this instanceof NullCell;
  }

  isArray(): this is ArrayCell {
    return this instanceof ArrayCell;
  }

  isRecord(): this is RecordCell {
    return this instanceof RecordCellType;
  }

  isRepeatedRecord(): this is RepeatedRecordCell {
    return this instanceof RepeatedRecordCell;
  }

  isRecordOrRepeatedRecord(): this is RecordOrRepeatedRecordCell {
    return this.isRepeatedRecord() || this.isRecord();
  }

  isNest(): this is NestCell {
    return this.isRepeatedRecord() || this.isRecord() || this.isArray();
  }

  isNumber(): this is NumberCell {
    return this instanceof NumberCell;
  }

  isDate(): this is DateCell {
    return this instanceof DateCell;
  }

  isTime(): this is TimeCell {
    return this.isDate() || this.isTimestamp();
  }

  isJSON(): this is JSONCell {
    return this instanceof JSONCell;
  }

  isString(): this is StringCell {
    return this instanceof StringCell;
  }

  isTimestamp(): this is TimestampCell {
    return this instanceof TimestampCell;
  }

  isBoolean(): this is BooleanCell {
    return this instanceof BooleanCell;
  }

  asCell(): Cell {
    if (
      this instanceof ArrayCell ||
      this instanceof RepeatedRecordCell ||
      this instanceof RecordCellType ||
      this instanceof NumberCell ||
      this instanceof DateCell ||
      this instanceof JSONCell ||
      this instanceof StringCell ||
      this instanceof TimestampCell ||
      this instanceof BooleanCell ||
      this instanceof NullCell ||
      this instanceof SQLNativeCell
    ) {
      return this;
    }
    throw new Error('Not a cell');
  }

  root(): Cell {
    if (this.parent) {
      return this.parent.root();
    } else {
      return this.asCell();
    }
  }

  private getPathInfo(path: string): {
    levelsUp: number;
    pathSegments: string[];
  } {
    const pathParts = path.split('/');
    const levelsUp = pathParts.filter(part => part === '..').length + 1;
    const pathSegments = pathParts.filter(part => part !== '..' && part !== '');
    return {levelsUp, pathSegments};
  }

  getParentRecord(levelsUp: number): RecordCell {
    let current: Cell | undefined = this.asCell();
    while (current && levelsUp > 0) {
      current = current.parent;
      while (current?.isArray()) {
        current = current.parent;
      }
      levelsUp--;
    }
    if (!current?.isRecord()) {
      throw new Error(`Parent ${levelsUp} levels up was not a record`);
    }
    return current;
  }

  getRelativeCell(relativeDataPath: string): Cell | undefined {
    try {
      const {levelsUp, pathSegments} = this.getPathInfo(relativeDataPath);
      const scope = this.getParentRecord(levelsUp);
      return scope.cellAtPath(pathSegments);
    } catch {
      return undefined;
    }
  }

  cellAt(path: string[] | string): Cell {
    if (typeof path === 'string') {
      return this.cellAtPath(JSON.parse(path));
    }
    return this.cellAtPath(path);
  }

  cellAtPath(path: string[]): Cell {
    console.log({path, cell: this});
    if (path.length === 0) {
      return this.asCell();
    }
    throw new Error(`${this.constructor.name} cannot contain columns`);
  }

  compareTo(_other: Cell): number {
    return 0;
  }

  canDrill() {
    return canDrill(this.asCell());
  }

  getStableDrillQuery(): Malloy.Query | undefined {
    return getStableDrillQuery(this.asCell());
  }

  getStableDrillClauses(): Malloy.DrillOperation[] | undefined {
    return getStableDrillClauses(this.asCell());
  }

  getDrillExpressions(): string[] {
    return getDrillExpressions(this.asCell());
  }

  getDrillEntries(): DrillEntry[] {
    return getDrillEntries(this.asCell());
  }

  getStableDrillQueryMalloy(): string | undefined {
    return getStableDrillQueryMalloy(this.asCell());
  }

  getDrillQueryMalloy(): string {
    return getDrillQueryMalloy(this.asCell());
  }
}
