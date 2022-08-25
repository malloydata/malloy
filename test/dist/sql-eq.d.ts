import { Result, Runtime } from "@malloydata/malloy";
interface InitValues {
    sql?: string;
    malloy?: string;
}
export declare function mkSqlEqWith(runtime: Runtime, initV?: InitValues): (expr: string, result: string | boolean) => Promise<Result>;
export {};
