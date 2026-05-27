import t from '/Users/ltabb/Downloads/agg_levels.json';

const allDims = new Map<string, string>();

for (const a of t) {
  for (const dim of a.agg_level.split('.')) {
    allDims.set(dim, 'x');
  }
}

console.log(`
  ##! experimental{composite_sources}
  source: cube_root is  presto_de.table('peu_cube_agg_level:measurementsystems')`);

for (const cube of t) {
  const name = '`cube' + cube.agg_level + '`';
  const levels = cube.agg_level.split('.');
  const except =
    '`' +
    Array.from(allDims.keys())
      .filter(x => !levels.includes(x))
      .join('`,`') +
    '`';
  console.log(`
  source: \`cube.${cube.agg_level}\` is cube_root extend {
    except: ${except}
    where: agg_level = '${cube.agg_level}'
  }
`);
}

console.log(`source: cube_base is compose(`);
console.log('`' + t.map(x => 'cube.' + x.agg_level).join('`,`') + '`');
console.log(`)`);
