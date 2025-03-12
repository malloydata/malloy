import {unstable_translateTSDefToFlowDef} from 'flow-api-translator';
import * as fs from 'fs';
import yargs from 'yargs/yargs';
import {hideBin} from 'yargs/helpers';

async function go() {
  const args = await yargs(hideBin(process.argv))
    .option('skip', {
      alias: 'skip',
      array: true,
      default: [] as string[],
      type: 'string',
      describe: 'Files to skip processing',
    })
    .help()
    .parse();

  const files = fs
    .readdirSync('./dist')
    .filter(
      f =>
        f.endsWith('.d.ts') &&
        !f.endsWith('.spec.d.ts') &&
        !args.skip.includes(f)
    );
  if (fs.existsSync('./@flowtyped'))
    fs.rmSync('./@flowtyped', {recursive: true});
  fs.mkdirSync('./@flowtyped');
  await Promise.all(
    files.map(async file => {
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
