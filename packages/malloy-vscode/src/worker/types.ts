interface NamedQuerySpec {
  type: "named";
  name: string;
  file: string;
}

interface QueryStringSpec {
  type: "string";
  text: string;
  file: string;
}

interface QueryFileSpec {
  type: "file";
  index: number;
  file: string;
}

interface NamedSQLQuerySpec {
  type: "named_sql";
  name: string;
  file: string;
}

interface UnnamedSQLQuerySpec {
  type: "unnamed_sql";
  index: number;
  file: string;
}

export type WorkerQuerySpec =
  | NamedQuerySpec
  | QueryStringSpec
  | QueryFileSpec
  | NamedSQLQuerySpec
  | UnnamedSQLQuerySpec;

export interface MessageExit {
  type: "exit";
}

export interface MessageRun {
  type: "run";
  query: WorkerQuerySpec;
  panelId: string;
}

export interface MessageCancel {
  type: "cancel";
  panelId: string;
}

export type Message = MessageCancel | MessageExit | MessageRun;
