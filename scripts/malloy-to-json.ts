/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as readline from 'readline';
import {inspect} from 'util';
import type {Connection} from '@malloydata/malloy';
import {Malloy} from '@malloydata/malloy';
import {BigQueryConnection} from '@malloydata/db-bigquery';
import {DuckDBConnection} from '../packages/malloy-db-duckdb';
import {readFile} from 'fs/promises';
import {readFileSync} from 'fs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pretty(thing: any): string {
  return inspect(thing, {breakLength: 72, depth: Infinity});
}

/*

CLI TRANSLATION UTILITY

Can be run with "npm run malloyc"

CURRENTLY HAS TWO MODES

1) npm run malloyc ( no arguments )
    Prompts for one line of input, parses that one
    line and dumps the translator output.

    The two things you want, multi line input, or being
    able to type two commands that operator on the same model,
    are not yet implemented.

2) npm run malloyc file1 file2 ...
    For each file parse and dump translator output

*/

async function printTranlsatedMalloy(fileSrc: string, fileURL: string) {
  const url = new URL(fileURL);
  const parse = Malloy.parse({source: fileSrc, url});
  const bqConn = new BigQueryConnection('bigquery');
  const ddbCon = new DuckDBConnection('duckdb');
  const lookupConnection = async function (name: string): Promise<Connection> {
    if (name === 'bigquery' || name === undefined) {
      return bqConn;
    } else if (name === 'duckdb') {
      return ddbCon;
    }
    throw new Error(`No connection ${name}`);
  };
  const readURL = async function (reqUrl: URL): Promise<string> {
    if (reqUrl.href === fileURL) {
      return fileSrc;
    }
    const filePath = reqUrl.pathname;
    const src = await readFile(filePath, {encoding: 'utf-8'});
    return src;
  };
  try {
    const model = await Malloy.compile({
      urlReader: {readURL},
      connections: {lookupConnection},
      parse,
    });
    console.log(pretty(model._modelDef));
  } catch (e) {
    console.log(e.message);
  }
}

function ask(
  rlObj: readline.Interface,
  prompt: string
): Promise<string | null> {
  return new Promise(resolve => {
    try {
      rlObj.question(prompt, resolve);
      rlObj.once('close', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

function fullPath(fn: string): string {
  if (fn[0] === '/') {
    return fn;
  }
  return `${process.cwd()}/${fn}`;
}

async function main() {
  if (process.argv.length > 2) {
    for (const fileArg of process.argv.slice(2)) {
      const filePath = fullPath(fileArg);
      const src = readFileSync(filePath, 'utf-8');
      const url = `file://${filePath}`;
      await printTranlsatedMalloy(src, url);
    }
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    let closed = false;
    rl.on('close', () => {
      closed = true;
    });
    while (!closed) {
      const src = await ask(rl, 'malloy> ');
      if (src) {
        await printTranlsatedMalloy(src, 'malloy://cli/stdin');
      } else {
        break;
      }
    }
    rl.close();
  }
}

main();
