import {unstable_translateTSDefToFlowDef} from 'flow-api-translator';
import * as fs from 'fs';
import * as path from 'path';
import yargs from 'yargs/yargs';
import {hideBin} from 'yargs/helpers';

function fixImports(flow: string, target: string | undefined): string {
  if (target) {
    flow = flow.replace(/ from "\.\/([a-z_-]+)";/gm, ` from "./${target}-$1";`);
  }
  return '// @flow\n' + flow;
}

// TODO - handle subdirectories
function fixFilename(file: string, target?: string, root?: string): string {
  if (target) {
    if (file === root) {
      return `${target}.js.flow`;
    } else {
      return `${target}-${file.replace('.d.ts', '.js.flow')}`;
    }
  }
  return file.replace('.d.ts', '.js.flow');
}

async function go() {
  const args = await yargs(hideBin(process.argv))
    .option('outdir', {
      alias: 'o',
      type: 'string',
      describe: 'Output directory',
      default: '@flowtyped',
    })
    .option('root', {
      alias: 'r',
      type: 'string',
      describe: 'Root file name',
    })
    .option('skip', {
      alias: 's',
      array: true,
      default: [] as string[],
      type: 'string',
      describe: 'Files to skip processing',
    })
    .option('target', {
      alias: 't',
      type: 'string',
      describe: 'Target file name',
    })
    .help()
    .parse();

  const inDir = path.resolve('dist');
  const outDir = path.resolve(args.outdir);

  const files = fs
    .readdirSync(inDir)
    .filter(
      file =>
        file.endsWith('.d.ts') &&
        !file.endsWith('.spec.d.ts') &&
        !args.skip.includes(file)
    );

  if (fs.existsSync(outDir)) fs.rmSync(outDir, {recursive: true});
  fs.mkdirSync(outDir);

  console.log(args);

  await Promise.all(
    files.map(async file => {
      console.log(`Generating flow types for file ${file}`);
      const inFile = path.resolve(inDir, file);
      const outFile = path.resolve(
        outDir,
        fixFilename(file, args.target, args.root)
      );
      const contents = fs.readFileSync(inFile, 'utf8');
      const raw = await unstable_translateTSDefToFlowDef(contents);
      const flow = fixImports(raw, args.target);
      return fs.promises.writeFile(outFile, flow);
    })
  );
}

go();
