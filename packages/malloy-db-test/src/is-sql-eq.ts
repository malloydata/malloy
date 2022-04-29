import { Result } from "@malloydata/malloy";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      isSqlEq(): R;
    }
  }
}

expect.extend({
  /**
   * Check the return of `sqlEQ(expr1,expr2)` and error if the database
   * does not find those two expressions to be equal.
   */
  isSqlEq(result: Result) {
    const wantEq = result.data.path(0, "calc").value;
    if (wantEq != "=") {
      return {
        pass: false,
        message: () => `${wantEq}\nSQL:\n${result.sql}`,
      };
    }
    return {
      pass: true,
      message: () => "SQL expression matched",
    };
  },
});
