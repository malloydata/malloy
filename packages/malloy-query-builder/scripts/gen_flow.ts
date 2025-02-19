// eslint-disable-next-line node/no-unpublished-import
import {unstable_translateTSDefToFlowDef} from 'flow-api-translator';
import * as fs from 'fs';

async function go() {
  const files = ['index.d.ts', 'query-ast.d.ts'];
  await Promise.all(
    files.map(async file => {
      const contents = fs.readFileSync(`./dist/${file}`, 'utf8');
      const flow = await unstable_translateTSDefToFlowDef(contents);
      console.log(flow);
    })
  );
}

go();
