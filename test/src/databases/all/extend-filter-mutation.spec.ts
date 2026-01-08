/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/**
 * Test for bug: Extending a source with a filter on a joined field
 * should NOT affect queries on the original source.
 *
 * Bug description:
 * When defining an extended source with a filter that references a join,
 * the filter was being incorrectly added to the original source's filterList
 * due to array mutation (push on shared reference instead of cloning).
 *
 * This caused queries on the original source to fail with errors like:
 * "Unrecognized name: <join_alias>_0"
 */

import {RuntimeList, allDatabases} from '../../runtimes';
import {databasesFromEnvironmentOr} from '../../util';
import {isSourceDef} from '@malloydata/malloy';

const runtimes = new RuntimeList(databasesFromEnvironmentOr(allDatabases));

describe.each(runtimes.runtimeList)(
  'extend filter mutation bug - %s',
  (databaseName, runtime) => {
    // This test checks the internal state to verify the bug
    test('filterList should not be mutated when extending a source', async () => {
      const model = runtime.loadModel(`
        source: aircraft_models is ${databaseName}.table('malloytest.aircraft_models') extend {
          primary_key: aircraft_model_code
        }

        source: aircraft is ${databaseName}.table('malloytest.aircraft') extend {
          primary_key: tail_num
          join_one: aircraft_models with aircraft_model_code
          where: tail_num != 'DOES_NOT_EXIST_12345'
        }
      `);

      // Get the model definition BEFORE extending
      const modelBefore = await model.getModel();
      const exploreBefore = modelBefore.getExploreByName('aircraft');
      // Access the internal structDef to check filterList
      const structDefBefore = exploreBefore.structDef;
      if (!isSourceDef(structDefBefore)) {
        throw new Error('aircraft is not a source');
      }
      const filterCountBefore = structDefBefore.filterList?.length ?? 0;

      // Now load a model that EXTENDS aircraft with a filter on joined field
      const extendedModel = model.extendModel(`
        source: aircraft_boeing is aircraft extend {
          where: aircraft_models.manufacturer = 'BOEING'
        }
      `);

      // Force the extended model to compile
      await extendedModel.getModel();

      // Check the original source's filterList again - it should NOT have changed
      // Important: we check the ORIGINAL model, not the extended one
      const modelAfter = await model.getModel();
      const exploreAfter = modelAfter.getExploreByName('aircraft');
      const structDefAfter = exploreAfter.structDef;
      if (!isSourceDef(structDefAfter)) {
        throw new Error('aircraft is not a source after extend');
      }
      const filterCountAfter = structDefAfter.filterList?.length ?? 0;

      // The original source should have the same number of filters
      // If this fails, the filterList was mutated!
      expect(filterCountAfter).toBe(filterCountBefore);
    });

    test('extending source with join filter should not affect original source', async () => {
      // This model defines:
      // 1. aircraft_models - a simple table
      // 2. aircraft - a table with a join to aircraft_models AND a source filter
      // 3. aircraft_boeing - extends aircraft with a filter on the JOINED table
      //
      // The bug: defining aircraft_boeing mutates aircraft's filterList,
      // causing queries on aircraft that don't use the join to fail.
      const model = runtime.loadModel(`
        source: aircraft_models is ${databaseName}.table('malloytest.aircraft_models') extend {
          primary_key: aircraft_model_code
        }

        source: aircraft is ${databaseName}.table('malloytest.aircraft') extend {
          primary_key: tail_num
          join_one: aircraft_models with aircraft_model_code
          // Original source has a filter that doesn't reference the join
          where: tail_num != 'DOES_NOT_EXIST_12345'
        }

        // This extended source has a filter on a joined field
        source: aircraft_boeing is aircraft extend {
          where: aircraft_models.manufacturer = 'BOEING'
        }
      `);

      // This query on the ORIGINAL source (aircraft) should work.
      // It doesn't use the aircraft_models join at all.
      // Before the fix, this fails with:
      // "Unrecognized name: aircraft_models_0; Did you mean ...?"
      const result = await model
        .loadQuery(
          `
        run: aircraft -> {
          group_by: foo is 1
          aggregate: cnt is count()
        }
      `
        )
        .run();

      expect(result.data.value).toHaveLength(1);
      expect(result.data.value[0]['foo']).toBe(1);
    });

    test('extended source with join filter should still work correctly', async () => {
      // Verify the extended source itself works correctly
      const model = runtime.loadModel(`
        source: aircraft_models is ${databaseName}.table('malloytest.aircraft_models') extend {
          primary_key: aircraft_model_code
        }

        source: aircraft is ${databaseName}.table('malloytest.aircraft') extend {
          primary_key: tail_num
          join_one: aircraft_models with aircraft_model_code
        }

        source: aircraft_boeing is aircraft extend {
          where: aircraft_models.manufacturer = 'BOEING'
        }
      `);

      // Query the extended source - this should only return Boeing aircraft
      const result = await model
        .loadQuery(
          `
        run: aircraft_boeing -> {
          group_by: manufacturer is aircraft_models.manufacturer
          aggregate: cnt is count()
        }
      `
        )
        .run();

      // Should only have Boeing records
      expect(result.data.value).toHaveLength(1);
      expect(result.data.value[0]['manufacturer']).toBe('BOEING');
    });

    test('multiple extended sources should not affect each other', async () => {
      // Define multiple extended sources with different filters
      const model = runtime.loadModel(`
        source: aircraft_models is ${databaseName}.table('malloytest.aircraft_models') extend {
          primary_key: aircraft_model_code
        }

        source: aircraft is ${databaseName}.table('malloytest.aircraft') extend {
          primary_key: tail_num
          join_one: aircraft_models with aircraft_model_code
        }

        source: aircraft_boeing is aircraft extend {
          where: aircraft_models.manufacturer = 'BOEING'
        }

        source: aircraft_cessna is aircraft extend {
          where: aircraft_models.manufacturer = 'CESSNA'
        }
      `);

      // Query the original source - should have all manufacturers
      const allResult = await model
        .loadQuery(
          `
        run: aircraft -> {
          group_by: foo is 1
          aggregate: cnt is count()
        }
      `
        )
        .run();

      // Query Boeing source
      const boeingResult = await model
        .loadQuery(
          `
        run: aircraft_boeing -> {
          group_by: manufacturer is aircraft_models.manufacturer
          aggregate: cnt is count()
        }
      `
        )
        .run();

      // Query Cessna source
      const cessnaResult = await model
        .loadQuery(
          `
        run: aircraft_cessna -> {
          group_by: manufacturer is aircraft_models.manufacturer
          aggregate: cnt is count()
        }
      `
        )
        .run();

      // Original should work and have more records than filtered sources
      expect(allResult.data.value).toHaveLength(1);
      const allCount = allResult.data.value[0]['cnt'] as number;

      expect(boeingResult.data.value).toHaveLength(1);
      expect(boeingResult.data.value[0]['manufacturer']).toBe('BOEING');
      const boeingCount = boeingResult.data.value[0]['cnt'] as number;

      expect(cessnaResult.data.value).toHaveLength(1);
      expect(cessnaResult.data.value[0]['manufacturer']).toBe('CESSNA');
      const cessnaCount = cessnaResult.data.value[0]['cnt'] as number;

      // All aircraft should be more than any single manufacturer
      expect(allCount).toBeGreaterThan(boeingCount);
      expect(allCount).toBeGreaterThan(cessnaCount);
    });
  }
);
