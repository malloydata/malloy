// eslint-disable-next-line node/no-unpublished-import
import {unstable_translateTSDefToFlowDef} from 'flow-api-translator';
import * as fs from 'fs';

async function go() {
  const skipFiles = ['expects.d.ts', 'query-ast.spec.d.ts'];
  const files = fs
    .readdirSync('./dist')
    .filter(f => f.endsWith('.d.ts') && !skipFiles.includes(f));
  await Promise.all(
    files.map(async file => {
      // eslint-disable-next-line no-console
      console.log(`Generating flow types for file ${file}`);
      const contents = fs.readFileSync(`./dist/${file}`, 'utf8');
      const flow = await unstable_translateTSDefToFlowDef(contents);
      // eslint-disable-next-line no-console
      console.log(flow);
    })
  );
}

go();
