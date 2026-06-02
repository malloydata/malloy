/* eslint-disable */
import * as fs from 'fs';
import {prettify} from '../packages/malloy/src/lang/prettify';

const file = process.argv[2];
if (!file) {
  console.error('usage: ts-node prettify-smoke.ts <file.malloy>');
  process.exit(1);
}
const src = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8');
const {result, errors} = prettify(src);
process.stdout.write(result);
if (errors.length > 0) {
  process.stderr.write(`\n--- ${errors.length} input parse error(s) ---\n`);
  for (const e of errors) {
    process.stderr.write(`  ${e.line}:${e.column}  ${e.message}\n`);
  }
}
// Re-parse the prettified output. Any new errors in the formatted output that
// weren't in the input mean the formatter corrupted syntax — surface loudly.
const {errors: outErrors} = prettify(result);
if (outErrors.length > errors.length) {
  process.stderr.write(
    `\n!!! formatter introduced ${outErrors.length - errors.length} new parse error(s) in output !!!\n`,
  );
  for (const e of outErrors) {
    process.stderr.write(`  ${e.line}:${e.column}  ${e.message}\n`);
  }
  process.exit(2);
}
