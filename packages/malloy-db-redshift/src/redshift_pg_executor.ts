/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import {QueryData} from '@malloydata/malloy';
import pg from 'pg';
import invariant from 'tiny-invariant';
// import * as dotenv from 'dotenv';

export interface RedShiftPGConnOptions {
  db_host: string;
  db_user: string;
  db_password: string;
  database?: string;
}

export class RedShiftPGExecutor {
  private client: pg.Client;
  constructor(options: RedShiftPGConnOptions) {
    this.client = new pg.Client({
      user: options.db_user,
      password: options.db_password,
      host: options.db_host,
      port: 5439,
      database: options.database,
    });
  }

  public static createFromEnv(): RedShiftPGExecutor {
    invariant(process.env['DB_HOST'] !== undefined, 'DB_HOST not set');
    invariant(process.env['DB_USER'] !== undefined, 'DB_USER not set');
    invariant(process.env['DB_PASSWORD'] !== undefined, 'DB_PASSWORD not set');
    return new RedShiftPGExecutor({
      db_host: process.env['DB_HOST'],
      db_user: process.env['DB_USER'],
      db_password: process.env['DB_PASSWORD'],
      database: process.env['DATABASE'],
    });
  }

  public async batch(sqlText: string): Promise<QueryData> {
    await this.client.connect();
    const results = await this.client.query(sqlText);
    await this.client.end();
    return results.rows;
  }
}

// dotenv.config();
// const executor = RedShiftPGExecutor.createFromEnv();
// executor.batch('SELECT * from malloytest.aircraft limit 2').then(data => {
//   console.log(data);
// });
