"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const runtimes_1 = require("./runtimes");
// Chris, please rework.
it.skip("accessors are not too expensive", async () => {
    // If this test fails, consideration should be given to how much time using
    // the accessors costs.
    const runtime = new runtimes_1.RuntimeList(["bigquery"]).runtimeMap.get("bigquery");
    expect(runtime).toBeDefined();
    if (runtime) {
        const result = await runtime
            .loadQuery("explore 'malloy-data.faa.flights' | reduce inner is (reduce top 1000000 distance id2)")
            .run();
        let noAccessorTime;
        let withAccessorTime;
        {
            const start = performance.now();
            const inner = result.data.value[0].inner;
            let total = 0;
            let count = 0;
            for (const row of inner) {
                total += row.distance;
                count += 1;
            }
            noAccessorTime = performance.now() - start;
            expect(total).toBe(88560989);
            expect(count).toBe(1000000);
            // Rough bound, not using accessors should be no more 50 milleseconds / million rows
            expect(noAccessorTime).toBeLessThan(50);
        }
        {
            const start = performance.now();
            const inner = result.data.row(0).cell("inner").array;
            let total = 0;
            let count = 0;
            for (const row of inner) {
                total += row.cell("distance").number.value;
                count += 1;
            }
            withAccessorTime = performance.now() - start;
            expect(total).toBe(88560989);
            expect(count).toBe(1000000);
            // Rough bound, using accessors should be no more 70 milleseconds / million rows
            expect(withAccessorTime).toBeLessThan(150);
        }
    }
});
//# sourceMappingURL=performance.spec.js.map