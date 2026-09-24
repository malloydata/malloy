/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  GetQueryExecutionCommandOutput,
  GetQueryResultsCommandOutput,
} from '@aws-sdk/client-athena';
import {
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  StartQueryExecutionCommand,
  StopQueryExecutionCommand,
} from '@aws-sdk/client-athena';
import type {AthenaCommandSender} from './athena_runner';
import {AthenaRunner} from './athena_runner';

/*
 * The fixtures are GetQueryExecution and GetQueryResults responses recorded
 * from an engine v3 workgroup, with only the bucket name and timings changed.
 * The two-page fixture is the real 2,500-row result trimmed to a few rows per
 * page; page 1 keeps its NextToken and page 2 has none.
 */
function fixture<T>(name: string): T {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8')
  );
}

type Execution = GetQueryExecutionCommandOutput;
type Results = GetQueryResultsCommandOutput;

/**
 * Answers the runner's commands from a script: one execution response per
 * poll, one results response per page, and records what was sent.
 */
class RecordedAthena {
  sent: unknown[] = [];
  constructor(
    private script: {
      start?: Error;
      poll?: Error;
      executions?: Execution[];
      results?: Results[];
    }
  ) {}

  get sender(): AthenaCommandSender {
    return this as unknown as AthenaCommandSender;
  }

  async send(command: unknown): Promise<unknown> {
    this.sent.push(command);
    if (command instanceof StartQueryExecutionCommand) {
      if (this.script.start) {
        throw this.script.start;
      }
      return {QueryExecutionId: 'exec-1'};
    }
    if (command instanceof GetQueryExecutionCommand) {
      if (this.script.poll) {
        throw this.script.poll;
      }
      const executions = this.script.executions ?? [];
      return executions.length > 1 ? executions.shift() : executions[0];
    }
    if (command instanceof GetQueryResultsCommand) {
      return this.script.results?.shift();
    }
    if (command instanceof StopQueryExecutionCommand) {
      return {};
    }
    throw new Error(`Unexpected command ${command?.constructor?.name}`);
  }

  ofType<T>(type: new (...args: never[]) => T): T[] {
    return this.sent.filter((c): c is T => c instanceof type);
  }
}

function runnerFor(script: ConstructorParameters<typeof RecordedAthena>[0]) {
  const athena = new RecordedAthena(script);
  const runner = new AthenaRunner(
    {workGroup: 'malloytest', database: 'malloytest'},
    athena.sender
  );
  return {athena, runner};
}

describe('AthenaRunner', () => {
  describe('decoding a SELECT result', () => {
    it('types scalars by ColumnInfo.Type, reads an absent value as NULL and drops the header row', async () => {
      const {runner} = runnerFor({
        executions: [fixture('scalars.execution.json')],
        results: [fixture('scalars.results.json')],
      });
      const result = await runner.runSQL('SELECT ...');
      expect(result.error).toBeUndefined();
      expect(result.columns).toEqual([
        {name: 'n', type: 'integer'},
        {name: 's', type: 'varchar'},
        {name: 'b', type: 'boolean'},
        {name: 'z', type: 'integer'},
        {name: 'empty', type: 'varchar'},
        {name: 'd', type: 'date'},
        {name: 't', type: 'timestamp'},
      ]);
      expect(result.rows).toEqual([
        [1, 'x', true, null, '', '2024-01-02', '2024-01-02 03:04:05.678'],
      ]);
    });

    it('reads NaN, the infinities, bigint, decimal, float and double as numbers', async () => {
      const {runner} = runnerFor({
        executions: [fixture('scalars.execution.json')],
        results: [fixture('numbers.results.json')],
      });
      const {rows, columns} = await runner.runSQL('SELECT ...');
      expect(columns.map(c => c.type)).toEqual([
        'double',
        'double',
        'double',
        'bigint',
        'decimal',
        'decimal',
        'integer',
        'float',
        'double',
      ]);
      const [nan, inf, ninf, big, dec, bigdec, intdiv, real, dbl] = rows[0];
      expect(nan).toBeNaN();
      expect(inf).toBe(Infinity);
      expect(ninf).toBe(-Infinity);
      // 9007199254740993 is exact on the wire and rounds to the nearest double
      expect(String(big)).toBe('9007199254740992');
      expect(dec).toBe(1.5);
      expect(bigdec).toBeCloseTo(12345678901234567000, -3);
      expect(intdiv).toBe(0);
      expect(real).toBe(0.1);
      expect(dbl).toBe(1e300);
    });

    it('parses a json column into the nested value, keeping field names and nulls', async () => {
      const {runner} = runnerFor({
        executions: [fixture('scalars.execution.json')],
        results: [fixture('json.results.json')],
      });
      const {rows, columns} = await runner.runSQL('SELECT ...');
      expect(columns.map(c => c.type)).toEqual(['json', 'json', 'json']);
      expect(rows[0]).toEqual([
        [
          {n: 1, s: 'a'},
          {n: 2, s: 'b'},
        ],
        {n: 1, Mixed: null},
        [1, null],
      ]);
    });

    it('passes row, array and map values through as the text Athena prints', async () => {
      const {runner} = runnerFor({
        executions: [fixture('scalars.execution.json')],
        results: [fixture('compound_text.results.json')],
      });
      const {rows, columns} = await runner.runSQL('SELECT ...');
      expect(columns.map(c => c.type)).toEqual([
        'array',
        'row',
        'map',
        'array',
      ]);
      expect(rows[0]).toEqual([
        '[1, 2]',
        '{n=1, s=x}',
        '{k=1}',
        '[{n=1, s=x}]',
      ]);
    });
  });

  describe('paging', () => {
    it('polls until the execution is terminal, follows NextToken and drops the header once', async () => {
      const {athena, runner} = runnerFor({
        executions: [
          fixture('pages.running.execution.json'),
          fixture('pages.execution.json'),
        ],
        results: [
          fixture('pages.page1.results.json'),
          fixture('pages.page2.results.json'),
        ],
      });
      const {rows} = await runner.runSQL('SELECT x FROM ...');
      expect(rows.map(r => r[0])).toEqual([1, 2, 3, 4, 1000, 1001, 1002]);
      expect(athena.ofType(GetQueryExecutionCommand)).toHaveLength(2);
      const pages = athena.ofType(GetQueryResultsCommand);
      expect(pages.map(p => p.input.NextToken)).toEqual([
        undefined,
        fixture<Results>('pages.page1.results.json').NextToken,
      ]);
      expect(pages[0].input.MaxResults).toBe(1000);
    });

    it('stops paging at rowLimit', async () => {
      const {athena, runner} = runnerFor({
        executions: [fixture('pages.execution.json')],
        results: [
          fixture('pages.page1.results.json'),
          fixture('pages.page2.results.json'),
        ],
      });
      const {rows} = await runner.runSQL('SELECT x FROM ...', {rowLimit: 3});
      expect(rows.map(r => r[0])).toEqual([1, 2, 3]);
      expect(athena.ofType(GetQueryResultsCommand)).toHaveLength(1);
    });

    it('keeps row 0 of a DESCRIBE, which has no header row', async () => {
      const {runner} = runnerFor({
        executions: [fixture('describe.execution.json')],
        results: [fixture('describe.results.json')],
      });
      const {rows, columns} = await runner.runSQL('DESCRIBE malloytest.t');
      expect(columns.map(c => c.name)).toEqual([
        'col_name',
        'data_type',
        'comment',
      ]);
      expect(rows).toHaveLength(9);
      expect(rows[0][0]).toMatch(/^n\s+\tint\s+\t/);
    });
  });

  describe('errors', () => {
    it('returns the StateChangeReason of a FAILED execution as the error', async () => {
      const {athena, runner} = runnerFor({
        executions: [fixture('missing_table.execution.json')],
      });
      const result = await runner.runSQL('SELECT * FROM no_such_table_malloy');
      expect(result.rows).toEqual([]);
      expect(result.error).toMatch(
        /^TABLE_NOT_FOUND: .*no_such_table_malloy' does not exist/
      );
      expect(athena.ofType(GetQueryResultsCommand)).toHaveLength(0);
    });

    it('returns a statement the parser rejects at submission as the error, with no execution to poll', async () => {
      const rejected = new Error(
        "line 1:1: mismatched input 'SELEC'. Expecting: 'ALTER', 'ANALYZE', ..."
      );
      rejected.name = 'InvalidRequestException';
      const {athena, runner} = runnerFor({start: rejected});
      const result = await runner.runSQL('SELEC 1');
      expect(result.error).toBe(
        "InvalidRequestException: line 1:1: mismatched input 'SELEC'. Expecting: 'ALTER', 'ANALYZE', ..."
      );
      expect(athena.ofType(GetQueryExecutionCommand)).toHaveLength(0);
    });

    it('returns a failure while polling as the error string', async () => {
      const throttled = new Error('Rate exceeded');
      throttled.name = 'TooManyRequestsException';
      const {runner} = runnerFor({poll: throttled});
      const result = await runner.runSQL('SELECT 1');
      expect(result.rows).toEqual([]);
      expect(result.error).toBe('TooManyRequestsException: Rate exceeded');
    });

    it('stops the execution and reports cancellation when the signal is aborted', async () => {
      const {athena, runner} = runnerFor({
        executions: [fixture('pages.running.execution.json')],
      });
      const controller = new AbortController();
      controller.abort();
      const result = await runner.runSQL('SELECT ...', {
        abortSignal: controller.signal,
      });
      expect(result.error).toBe('Query cancelled by the caller');
      expect(athena.ofType(StopQueryExecutionCommand)).toHaveLength(1);
    });
  });

  describe('the statement it submits', () => {
    it('names the workgroup, catalog and database, prefixes the metadata comment, and asks for result reuse when configured', async () => {
      const athena = new RecordedAthena({
        executions: [fixture('scalars.execution.json')],
        results: [fixture('scalars.results.json')],
      });
      const runner = new AthenaRunner(
        {
          workGroup: 'wg',
          catalog: 'AwsDataCatalog',
          database: 'db',
          outputLocation: 's3://malloytest-results/results/',
          resultReuseMaxAgeMinutes: 60,
        },
        athena.sender
      );
      await runner.runSQL('SELECT 1', {}, '-- {"user":"x"}\n');
      const [start] = athena.ofType(StartQueryExecutionCommand);
      expect(start.input).toEqual({
        QueryString: '-- {"user":"x"}\nSELECT 1',
        WorkGroup: 'wg',
        QueryExecutionContext: {Catalog: 'AwsDataCatalog', Database: 'db'},
        ResultConfiguration: {
          OutputLocation: 's3://malloytest-results/results/',
        },
        ResultReuseConfiguration: {
          ResultReuseByAgeConfiguration: {Enabled: true, MaxAgeInMinutes: 60},
        },
      });
    });

    it('omits the output location and result reuse when neither is configured', async () => {
      const {athena, runner} = runnerFor({
        executions: [fixture('scalars.execution.json')],
        results: [fixture('scalars.results.json')],
      });
      await runner.runSQL('SELECT 1');
      const [start] = athena.ofType(StartQueryExecutionCommand);
      expect(start.input.ResultConfiguration).toBeUndefined();
      expect(start.input.ResultReuseConfiguration).toBeUndefined();
    });
  });
});
