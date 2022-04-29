import { Result, Runtime } from "@malloydata/malloy";

interface InitValues {
  sql?: string;
  malloy?: string;
}

export function mkSqlEq(runtime: Runtime, initV?: InitValues) {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  return async function (
    expr: string,
    result: string | boolean
  ): Promise<Result> {
    const qExpr = expr.replace(/'/g, "`");
    const sqlV = initV?.sql || "SELECT 1 as one";
    const malloyV = initV?.malloy || "";
    const sourceDef = `
      sql: sqlData is || ${sqlV} ;;
      source: basicTypes is from_sql(sqlData) ${malloyV}
    `;
    let query: string;
    if (typeof result == "boolean") {
      const notEq = `'sqlEq failed\nExpected: ${qExpr} to be ${result}`;
      const whenPick = result ? "'=' when exprTrue" : `${notEq} when exprTrue`;
      const elsePick = result ? notEq : "'='";
      query = `${sourceDef}
          query: basicTypes
          -> { project: exprTrue is ${expr} }
          -> {
            project: calc is pick ${whenPick} else ${elsePick}
          }`;
    } else {
      const qResult = result.replace(/'/g, "`");
      query = `${sourceDef}
          query: basicTypes
          -> {
            project: expect is ${result}
            project: got is ${expr}
          } -> {
            project: calc is
              pick '=' when expect = got
              else concat('sqlEq failed\nExpected: ${qExpr} == ${qResult}.\nReceived: ', got::string)
          }`;
    }
    return runtime.loadQuery(query).run();
  };
}
