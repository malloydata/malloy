// eslint-disable-next-line node/no-unpublished-import
import {unstable_translateTSDefToFlowDef} from 'flow-api-translator';
import * as fs from 'fs';

async function go() {
  const skipFiles = [
    'expects.d.ts',
    'query-ast.spec.d.ts',
    'query-ast.spec.js.map',
    'query-ast.spec.js',
    'query-ast.js.map',
  ];
  const files = fs.readdirSync('./dist').filter(f => !skipFiles.includes(f));
  await Promise.all(
    files.map(async file => {
      console.log(`Generating flow types for file ${file}`);
      const contents = fs.readFileSync(`./dist/${file}`, 'utf8');
      const flow = await unstable_translateTSDefToFlowDef(contents);
      console.log(flow);
    })
  );
}

go();
