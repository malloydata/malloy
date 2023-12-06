/** Query execution stats. */
export type QueryRunStats = {
  queryCostBytes?: number;
};

/** Malloy source annotations attached to objects */
export interface Annotation {
  inherits?: Annotation;
  blockNotes?: Note[];
  notes?: Note[];
}
export interface Note {
  text: string;
  at: DocumentLocation;
}

export interface DocumentLocation {
  url: string;
  range: DocumentRange;
}

export interface DocumentRange {
  start: DocumentPosition;
  end: DocumentPosition;
}

export interface DocumentPosition {
  line: number;
  character: number;
}

/** A row of returned data. */
export type QueryDataRow = {[columnName: string]: QueryValue};

export type QueryScalar = string | boolean | number | Date | Buffer | null;

/** One value in one column of returned data. */
export type QueryValue = QueryScalar | QueryData | QueryDataRow;

/** Returned query data. */
export type QueryData = QueryDataRow[];

/** Returned Malloy query data */
export type MalloyQueryData = {
  rows: QueryDataRow[];
  totalRows: number;
  runStats?: QueryRunStats;
  profilingUrl?: string;
};

/** All names have their source names and how they will appear in the symbol table that owns them */
export interface AliasedName {
  name: string;
  as?: string;
}

/** put location into the parse tree. */
export interface HasLocation {
  location?: DocumentLocation;
}

/** all named objects have a type an a name (optionally aliased) */
export interface NamedObject extends AliasedName, HasLocation {
  type: string;
}

export interface SQLBlock extends NamedObject {
  type: 'sqlBlock';
  connection?: string;
  selectStr: string;
}
