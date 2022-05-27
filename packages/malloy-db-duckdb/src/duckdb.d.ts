
declare module "duckdb" {
  declare class Connection {
    all(sql: string, callback: (error: Error, result: any) => void);
  }

  declare class Database {
    constructor(path: string);
    constructor();
    constructor(path: string, mode: Number);

    connect(): Connection;
  }

  export const OPEN_READONLY: Number;
}