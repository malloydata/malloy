declare module "duckdb" {
  class Database {
    constructor(path: string);
    all(sql: string, callback: (error: Error, result: any) => void): void;
  }
}
