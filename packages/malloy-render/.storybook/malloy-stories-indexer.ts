import path from 'path';
import {PluginOption} from 'vite';
import type {IndexInput, Indexer} from '@storybook/types';
import fs from 'fs';
import {DuckDBConnection} from '@malloydata/db-duckdb';
import {Model, SingleConnectionRuntime, URLReader} from '@malloydata/malloy';

const STORY_MODEL_PREFIX = /##\(story\)\s/;
const STORY_PREFIX = /#\(story\)\s/;

async function createConnection() {
  // TODO: figure out how to get duckdb.table to load based on taht path, rather than from workingDirectory. so that malloy story files can be anywhere
  const workingDirectory = path.join(__dirname, '../src/stories');
  const connection = new DuckDBConnection(
    'duckdb',
    undefined,
    workingDirectory,
    {
      rowLimit: 1000,
    }
  );
  await connection.connecting;
  return connection;
}

async function getMaterializedModel(fileName: string) {
  const connection = await createConnection();
  const modelCode = fs.readFileSync(fileName, 'utf-8');
  const runtime = new SingleConnectionRuntime({connection});
  const model = runtime.loadModel(modelCode);

  const materializedModel = await model.getModel();
  return materializedModel;
}

type ModelIndexInput = IndexInput & {
  sourceName: string;
  queryName: string;
};

function fileNameToComponentName(fileName: string) {
  const regex = /\/([^\/]+)\.stories\.malloy$/;
  const match = fileName.match(regex);
  const name = match && match[1];
  if (name) {
    return name
      .split(/[-_]/)
      .map(part => {
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(' ');
  }
}

function getModelStories(materializedModel: Model, fileName: string) {
  const models = materializedModel.explores;
  let modelStories: ModelIndexInput[] = [];

  const isLegacy = materializedModel.tagParse().tag.has('renderer_legacy');
  const componentName =
    materializedModel
      .tagParse({prefix: STORY_MODEL_PREFIX})
      .tag.text('component') ?? fileNameToComponentName(fileName);

  models.forEach(model => {
    model.allFields
      .filter(f => f.isQueryField() && f.getTaglines(STORY_PREFIX).length > 0)
      .forEach(query => {
        modelStories.push({
          type: 'story',
          importPath: fileName,
          title: `Malloy ${isLegacy ? 'Legacy' : 'Next'}/${componentName}`,
          exportName: query.name,
          name: query.tagParse({prefix: STORY_PREFIX}).tag.text('story'),
          sourceName: model.name,
          queryName: query.name,
        });
      });
  });
  return {
    componentName,
    isLegacy,
    stories: modelStories,
  };
}

export const malloyStoriesIndexer: Indexer = {
  test: /stories\.malloy$/,
  createIndex: async fileName => {
    const connection = await createConnection();
    const modelCode = fs.readFileSync(fileName, 'utf-8');
    const urlReader: URLReader = {
      async readURL(url) {
        const pathToUrl = path.join(fileName, '..', url.href);
        const contents = fs.readFileSync(pathToUrl, 'utf-8');
        return contents;
      },
    };
    const runtime = new SingleConnectionRuntime({urlReader, connection});
    const model = runtime.loadModel(modelCode);
    const materializedModel = await model.getModel();
    const modelStories = getModelStories(materializedModel, fileName).stories;
    return modelStories;
  },
};

export function viteMalloyStoriesPlugin(): PluginOption {
  return {
    name: 'vite-plugin-storybook-malloy-stories',
    async transform(code, id) {
      if (id.endsWith('.stories.malloy')) {
        const model = await getMaterializedModel(id);
        const modelStoriesMeta = getModelStories(model, id);

        const storyExports = modelStoriesMeta.stories
          .map(
            meta => `
          export const ${meta.exportName} = {
            args: {
              source: '${meta.sourceName}',
              view: '${meta.queryName}',
            },
          };
          `
          )
          .join('\n');

        const header = modelStoriesMeta.isLegacy
          ? `
          import script from '${id}?raw';
          import {renderMalloyLegacy} from './util';

          export default {
            title: 'Malloy Legacy/Basic',
            render: ({source, view}, {globals: {getConnection}}) => {
              return renderMalloyLegacy({script, source, view, connection: getConnection()});
            },
            argTypes: {},
          };`
          : `
          import script from '${id}?raw';
          import {createLoader} from './util';
          import './themes.css';
          import {MalloyRenderer} from '../api/malloy-renderer';
          import {DummyPluginFactory} from '@/plugins/dummy-plugin';
          import {DummyDOMPluginFactory} from '@/plugins/dummy-dom-plugin';

          const meta = {
            title: "Malloy Next/${modelStoriesMeta.componentName}",
            render: ({classes}, context) => {
              const parent = document.createElement('div');
              parent.style.height = 'calc(100vh - 40px)';
              parent.style.position = 'relative';

              const button = document.createElement('button');
              button.innerHTML = "Copy HTML";
              button.addEventListener("click", () => viz.copyToHTML());
               parent.appendChild(button);

              const targetElement = document.createElement('div');
              if(classes) targetElement.classList.add(classes);
              targetElement.style.height = '100%';
              targetElement.style.width = '100%';
              parent.appendChild(targetElement);

              const renderer = new MalloyRenderer({
                plugins: [
                  DummyPluginFactory,
                  DummyDOMPluginFactory,
                ],
              });
              const viz = renderer.createViz({
                onError: error => {
                  console.log('Malloy render error', error);
                },
              });
              viz.setResult(context.loaded['result']);
              const metadata = viz.getMetadata();
              console.log('initial state', metadata);
              console.log('render properties', metadata.getFieldEntry(metadata.rootField.key).renderProperties);
              viz.render(targetElement);

              return parent;
            },
            loaders: [createLoader(script)],
            argTypes: {},
          };
          export default meta;
          `;

        const generatedCode = `
        ${header}
        ${storyExports}
      `;
        return generatedCode;
      }
    },
  };
}
