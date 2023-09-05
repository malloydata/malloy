// Note the use of the .js extensions for imports (not necessary for type imports)
// to run with Karma
import {
  loadMonacoAssets,
  generateMonarchTokenizations,
} from '../../test/generateMonarchTokenizations.js';
import {malloyDarkPlusConfig as testConfig} from '../../test/config/monaco/malloyDarkPlusConfig.js';
import {TestItem, monarchTestMatchers} from '../../test/testUtils.js';

let actualTokenizations: TestItem[][];

beforeAll(async () => {
  // @ts-ignore
  // for (var file in window.__karma__.files) {
  //   console.log(file)
  // }
  await loadMonacoAssets();
  // The call to loadMonacoAssets make the monaco global accessible in Karma Chrome tests
  // @ts-ignore
  actualTokenizations = generateMonarchTokenizations(monaco, testConfig);
  jasmine.addMatchers(monarchTestMatchers);
});
describe(testConfig.language.id, () => {
  for (let i = 0; i < testConfig.expectations.length; i++) {
    describe(`tokenizes block #${i}`, () => {
      for (let j = 0; j < testConfig.expectations[i].length; j++) {
        it(`tokenizes line "${testConfig.expectations[i][j].line}"`, () => {
          const actual = actualTokenizations[i][j];
          const expected = testConfig.expectations[i][j];
          expect(actual).toMatchColorData(expected);
        });
      }
    });
  }
});
