/* eslint-disable */
// SPIKE harness: not product code. See README.md.
// The PR's design: malloy-embedded.js + malloy-duckdb's real js/driver.js.
import {newQuickJSWASMModuleFromVariant} from 'quickjs-emscripten-core';
import variant from '@jitl/quickjs-ng-wasmfile-release-sync';
import {readFileSync} from 'fs';
import {execFileSync} from 'child_process';
const EXT = process.env.MALLOY_DUCKDB; // absolute path to a lloydtabb/malloy-duckdb checkout
if (!EXT) throw new Error('set MALLOY_DUCKDB to a malloy-duckdb checkout');
const MODELS = `file://${EXT}/test/models/`;
const counts = {readURL: 0, describe: 0};
const QuickJS = await newQuickJSWASMModuleFromVariant(variant);
const rt = QuickJS.newRuntime();
rt.setMemoryLimit(512 * 1024 * 1024);
rt.setMaxStackSize(0);
const vm = rt.newContext();
const hostObj = vm.newObject();
const impls = {
  readURL: u => {
    counts.readURL++;
    return readFileSync(new URL(u), 'utf8');
  },
  describe: from => {
    counts.describe++;
    const rows = JSON.parse(
      execFileSync(
        'node',
        ['duck.cjs', 'test.db', `DESCRIBE SELECT * FROM ${from}`],
        {encoding: 'utf8'}
      )
    );
    return JSON.stringify(rows.map(r => [r.column_name, r.column_type]));
  },
};
for (const [name, impl] of Object.entries(impls)) {
  const h = vm.newFunction(name, a => {
    try {
      return vm.newString(impl(vm.getString(a)));
    } catch (e) {
      return {error: vm.newError(e.message)};
    }
  });
  vm.setProp(hostObj, name, h);
  h.dispose();
}
vm.setProp(vm.global, '__malloyHost', hostObj);
hostObj.dispose();
for (const f of [
  new URL('../dist/', import.meta.url).pathname + 'malloy-embedded.js',
  `${EXT}/js/help-content.js`,
  `${EXT}/js/driver.js`,
])
  vm.unwrapResult(vm.evalCode(readFileSync(f, 'utf8'), f)).dispose();
function call(name, ...args) {
  const before = {...counts};
  const t = Date.now();
  const api = vm.getProp(vm.global, 'malloyDuckDB');
  const fn = vm.getProp(api, name);
  const hs = args.map(a => vm.newString(a));
  const r = vm.callFunction(fn, api, ...hs);
  hs.forEach(h => h.dispose());
  fn.dispose();
  api.dispose();
  const out = r.error ? 'ERROR ' + vm.dump(r.error).message : vm.dump(r.value);
  (r.error ?? r.value).dispose();
  const delta = Object.fromEntries(
    Object.keys(counts).map(k => [k, counts[k] - before[k]])
  );
  console.log(
    `== ${name} ${args[1] ?? ''}  (${Date.now() - t} ms, host calls ${JSON.stringify(delta)})`
  );
}
call('toSQL', MODELS + 'flights.malloy', 'run: flights -> by_carrier');
call(
  'toSQL',
  MODELS + 'flights.malloy',
  'run: flights -> { group_by: origin; aggregate: flight_count }'
);
call('toSQL', MODELS + 'flights.malloy', 'run: flights -> by_carrier');
call(
  'toSQL',
  MODELS + 'movies.malloy',
  'run: movies -> { group_by: directors.name; aggregate: n is count() }'
);
