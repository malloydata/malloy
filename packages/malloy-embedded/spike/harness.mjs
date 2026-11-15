/* eslint-disable */
// SPIKE harness: not product code. See README.md.
// Runs malloy-runtime.js + driver-foundation.js in QuickJS-ng (WASM), with a
// synchronous host backed by a real DuckDB file. Counts host calls.
import {newQuickJSWASMModuleFromVariant} from 'quickjs-emscripten-core';
import variant from '@jitl/quickjs-ng-wasmfile-release-sync';
import {readFileSync, statSync} from 'fs';
import {execFileSync} from 'child_process';

const BUNDLE = new URL('../dist/malloy-runtime.js', import.meta.url).pathname;
const EXT = process.env.MALLOY_DUCKDB; // absolute path to a lloydtabb/malloy-duckdb checkout
if (!EXT) throw new Error('set MALLOY_DUCKDB to a malloy-duckdb checkout');
const MODELS = `file://${EXT}/test/models/`;
const counts = {readURL: 0, mtime: 0, query: 0};
const log = [];

const QuickJS = await newQuickJSWASMModuleFromVariant(variant);
const rt = QuickJS.newRuntime();
rt.setMemoryLimit(512 * 1024 * 1024);
rt.setMaxStackSize(0);
const vm = rt.newContext();

const fn = (name, impl) => {
  const h = vm.newFunction(name, (...args) => {
    try {
      const r = impl(...args.map(a => vm.getString(a)));
      return r === null ? vm.null : vm.newString(r);
    } catch (e) {
      return {error: vm.newError(e.message)};
    }
  });
  return h;
};
const hostObj = vm.newObject();
for (const [name, impl] of Object.entries({
  readURL: u => {
    counts.readURL++;
    log.push(`readURL ${u}`);
    return readFileSync(new URL(u), 'utf8');
  },
  mtime: u => {
    counts.mtime++;
    try {
      return String(statSync(new URL(u)).mtimeMs);
    } catch {
      return null;
    }
  },
  query: sql => {
    counts.query++;
    log.push(`query ${sql.replace(/\s+/g, ' ').slice(0, 70)}`);
    return execFileSync('node', ['duck.cjs', 'test.db', sql], {
      encoding: 'utf8',
    });
  },
})) {
  const h = fn(name, impl);
  vm.setProp(hostObj, name, h);
  h.dispose();
}
vm.setProp(vm.global, '__malloyHost', hostObj);
hostObj.dispose();

function evalFile(path) {
  const t = Date.now();
  vm.unwrapResult(vm.evalCode(readFileSync(path, 'utf8'), path)).dispose();
  return Date.now() - t;
}
console.log(
  'no Intl in this engine:',
  vm.dump(vm.unwrapResult(vm.evalCode('typeof Intl')))
);
console.log(`load bundle: ${evalFile(BUNDLE)} ms`);
evalFile('driver-foundation.js');

// Call malloyDuckDB[name](...args); drain jobs until its promise settles.
function call(name, ...args) {
  const before = {...counts};
  log.length = 0;
  const t = Date.now();
  const api = vm.getProp(vm.global, 'malloyDuckDB');
  const f = vm.getProp(api, name);
  const handles = args.map(a => vm.newString(a));
  const p = vm.unwrapResult(vm.callFunction(f, api, ...handles));
  handles.forEach(h => h.dispose());
  f.dispose();
  api.dispose();
  let state;
  for (let i = 0; ; i++) {
    rt.executePendingJobs();
    state = vm.getPromiseState(p);
    if (state.type !== 'pending') break;
    if (i > 1000)
      throw new Error(
        'promise never settled: something waits on a timer or real IO'
      );
  }
  p.dispose();
  const ms = Date.now() - t;
  const delta = Object.fromEntries(
    Object.keys(counts).map(k => [k, counts[k] - before[k]])
  );
  if (state.type === 'rejected') {
    const err = vm.dump(state.error);
    state.error.dispose();
    return {ms, delta, error: err.message ?? err, log: [...log]};
  }
  const value = vm.dump(state.value);
  state.value.dispose();
  return {ms, delta, value, log: [...log]};
}

const show = (label, r) => {
  console.log(
    `\n== ${label}  (${r.ms} ms, host calls ${JSON.stringify(r.delta)})`
  );
  if (r.error) console.log('ERROR:', r.error);
  else
    console.log(
      typeof r.value === 'string' ? r.value : JSON.stringify(r.value, null, 1)
    );
  if (r.log.length) console.log('  host:', r.log.join('\n        '));
};

show(
  'toSQL #1 (cold)',
  call('toSQL', MODELS + 'flights.malloy', 'run: flights -> by_carrier')
);
show(
  'toSQL #2 (same model, different query)',
  call(
    'toSQL',
    MODELS + 'flights.malloy',
    'run: flights -> { group_by: origin; aggregate: flight_count }'
  )
);
show(
  'toSQL #3 (same again)',
  call('toSQL', MODELS + 'flights.malloy', 'run: flights -> by_carrier')
);
show('listSources', call('listSources', MODELS + 'movies.malloy'));
show(
  'toSQL arrays of records',
  call(
    'toSQL',
    MODELS + 'movies.malloy',
    'run: movies -> { group_by: directors.name; aggregate: n is count() }'
  )
);
show(
  'time literal + filter expression, no Intl',
  call(
    'toSQL',
    MODELS + 'flights.malloy',
    "run: flights -> { where: @2003-01-15 10:00 < @2004, origin ~ f'JFK, LAX'; aggregate: flight_count }"
  )
);
show(
  'session add #1',
  call(
    'sessionAdd',
    "source: f is duckdb.table('flights') extend { measure: n is count() }"
  )
);
show(
  'session add #2 (extends #1)',
  call(
    'sessionAdd',
    'source: f2 is f extend { dimension: long is distance > 150 }'
  )
);
show(
  'session query',
  call('sessionSQL', 'run: f2 -> { group_by: long; aggregate: n }')
);
show(
  'session error position',
  call('sessionAdd', 'source: bad is f extend {\n  dimension: x is nope + 1\n}')
);
show(
  'compile error',
  call(
    'toSQL',
    MODELS + 'flights.malloy',
    'run: flights -> { group_by: no_such_field }'
  )
);
