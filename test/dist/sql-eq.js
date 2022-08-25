"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mkSqlEqWith = void 0;
function mkSqlEqWith(runtime, initV) {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    return async function (expr, result) {
        const qExpr = expr.replace(/'/g, "`");
        const sqlV = (initV === null || initV === void 0 ? void 0 : initV.sql) || "SELECT 1 as one";
        const malloyV = (initV === null || initV === void 0 ? void 0 : initV.malloy) || "";
        const sourceDef = `
      sql: sqlData is || ${sqlV} ;;
      source: basicTypes is from_sql(sqlData) ${malloyV}
    `;
        let query;
        if (typeof result == "boolean") {
            const notEq = `concat('sqlEq failed', CHR(10), '    Expected: ${qExpr} to be ${result}')`;
            const varName = result ? "expectTrue" : "expectFalse";
            const whenPick = result
                ? `'=' when ${varName}`
                : `${notEq} when ${varName}`;
            const elsePick = result ? notEq : "'='";
            query = `${sourceDef}
          query: basicTypes
          -> { project: ${varName} is ${expr} }
          -> {
            project: calc is pick ${whenPick} else ${elsePick}
          }`;
        }
        else {
            const qResult = result.replace(/'/g, "`");
            query = `${sourceDef}
          query: basicTypes
          -> {
            project: expect is ${result}
            project: got is ${expr}
          } -> {
            project: calc is
              pick '=' when expect = got
              else concat('sqlEq failed', CHR(10), '    Expected: ${qExpr} == ${qResult}', CHR(10), '    Received: ', got::string)
          }`;
        }
        return runtime.loadQuery(query).run();
    };
}
exports.mkSqlEqWith = mkSqlEqWith;
//# sourceMappingURL=sql-eq.js.map