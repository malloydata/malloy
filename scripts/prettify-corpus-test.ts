/* eslint-disable */
// Sweep a list of malloy files. For each: prettify, verify the prettified
// output still parses with the same number of errors as the input, and verify
// idempotency (prettify twice → same result).
import * as fs from 'fs';
import {prettify} from '../packages/malloy/src/lang/prettify';

const files = process.argv.slice(2);
let fails = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const r1 = prettify(src);
  const r2 = prettify(r1.result);
  const idem = r1.result === r2.result;
  const newErrors = r2.errors.length > r1.errors.length;
  const status = !idem ? 'DRIFT' : newErrors ? 'NEW-ERRS' : 'ok';
  console.log(
    `${status.padEnd(10)} in_err=${r1.errors.length}  out_err=${r2.errors.length}  ` +
    `in_lines=${src.split('\n').length}  out_lines=${r1.result.split('\n').length}  ${f}`,
  );
  if (status !== 'ok') {
    fails++;
    if (newErrors) {
      console.log('  new errors in output:');
      for (const e of r2.errors.slice(0, 5)) {
        console.log(`    ${e.line}:${e.column}  ${e.message}`);
      }
    }
  }
}
process.exit(fails > 0 ? 1 : 0);
