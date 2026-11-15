/* eslint-disable */
// SPIKE harness: not product code. See README.md.
// Compile each top-level statement of the IIFE body on its own in QuickJS
// (compile only), to find the one QuickJS rejects.
import {newQuickJSWASMModuleFromVariant} from 'quickjs-emscripten-core';
import variant from '@jitl/quickjs-ng-wasmfile-release-sync';
import {readFileSync} from 'fs';
import {createRequire} from 'module';
const acorn = createRequire(import.meta.url)('acorn');
const src = readFileSync(process.argv[2], 'utf8');
const ast = acorn.parse(src, {ecmaVersion: 2022});
const body = ast.body.find(s => s.expression?.type === 'CallExpression')
  .expression.callee.body.body;
const QuickJS = await newQuickJSWASMModuleFromVariant(variant);
const vm = QuickJS.newContext();
let bad = 0;
function check(node, depth) {
  const code = src.slice(node.start, node.end);
  const r = vm.evalCode(`(function(){${code}\n})`, 'x.js', {compileOnly: true});
  if (r.error) {
    const e = vm.dump(r.error);
    r.error.dispose();
    if (/underflow/.test(e.message)) return {code, e};
    return null;
  }
  r.value.dispose();
  return null;
}
for (const s of body) {
  const hit = check(s);
  if (hit) {
    bad++;
    console.log(
      `stmt @${s.start}: ${hit.e.message}\n${hit.code.slice(0, 300)}\n...`
    );
  }
}
console.log('bad statements:', bad, 'of', body.length);
