import {unstable_translateTSDefToFlowDef} from 'flow-api-translator';
import * as fs from 'fs';

async function go() {
  const files = fs
    .readdirSync('./dist')
    .filter(f => f.endsWith('.d.ts') && !f.endsWith('.spec.d.ts'));
  if (fs.existsSync('./@flowtyped'))
    fs.rmSync('./@flowtyped', {recursive: true});
  fs.mkdirSync('./@flowtyped');
  await Promise.all(
    files.map(async file => {
      // eslint-disable-next-line no-console
      console.log(`Generating flow types for file ${file}`);
      const contents = fs.readFileSync(`./dist/${file}`, 'utf8');
      const flow = await unstable_translateTSDefToFlowDef(contents);
      await fs.promises.writeFile(
        `./@flowtyped/${file.replace('.d.ts', '.js.flow')}`,
        '// @flow\n' + flow
      );
    })
  );
}

go();
