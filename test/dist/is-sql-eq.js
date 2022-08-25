"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
expect.extend({
    /**
     * Check the return of `sqlEQ(expr1,expr2)` and error if the database
     * does not find those two expressions to be equal.
     */
    isSqlEq(result) {
        const wantEq = result.data.path(0, "calc").value;
        const sql = result.sql.replace(/\n/g, "\n    ");
        if (wantEq != "=") {
            return {
                pass: false,
                message: () => `${wantEq}\nSQL:\n    ${sql}`,
            };
        }
        return {
            pass: true,
            message: () => "SQL expression matched",
        };
    },
});
//# sourceMappingURL=is-sql-eq.js.map