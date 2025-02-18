// eslint-disable-next-line node/no-unpublished-import
import {unstable_translateTSDefToFlowDef} from 'flow-api-translator';
import * as fs from 'fs';

describe('flow types', () => {
  test('should be able to generate flow types for AST', async () => {
    const files = ['index.d.ts', 'query-ast.d.ts'];
    await Promise.all(
      files.map(async file => {
        const contents = fs.readFileSync(
          `./packages/malloy-query-builder/dist/${file}`,
          'utf8'
        );
        // Will throw if it fails
        await unstable_translateTSDefToFlowDef(contents);
      })
    );
  });
});
