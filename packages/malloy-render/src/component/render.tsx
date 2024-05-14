import {ModelDef, QueryResult, Result, Tag} from '@malloydata/malloy';
import {Match, Show, Switch, createEffect, createMemo} from 'solid-js';
import {getResultMetadata} from './render-result-metadata';
import {ResultContext} from './result-context';
import {Chart} from './chart';
import MalloyTable from './table/table';
import './render.css';
import {shouldRenderAs} from './util';
import {ComponentOptions, ICustomElement} from 'component-register';

export type MalloyRenderProps = {
  result?: Result;
  queryResult?: QueryResult;
  modelDef?: ModelDef;
};

export function MalloyRender(
  props: MalloyRenderProps,
  {element}: ComponentOptions
) {
  const result = createMemo(() => {
    if (props.result) return props.result;
    else if (props.queryResult && props.modelDef)
      return new Result(props.queryResult, props.modelDef);
    else return null;
  });

  return (
    <Show when={result()}>
      <MalloyRenderInner result={result()!} element={element} />
    </Show>
  );
}

export function MalloyRenderInner(props: {
  result: Result;
  element: ICustomElement;
}) {
  const metadata = createMemo(() => getResultMetadata(props.result));
  const tags = () => {
    const modelTag = props.result.modelTag;
    const resultTag = props.result.tagParse().tag;
    const modelTheme = modelTag.tag('theme');
    const localTheme = resultTag.tag('theme');
    return {
      modelTag,
      resultTag,
      modelTheme,
      localTheme,
    };
  };

  createEffect(() => {
    if (props.element) {
      const style = generateThemeStyle(tags().modelTheme, tags().localTheme);
      for (const [key, value] of Object.entries(style)) {
        props.element['style'].setProperty(key, value);
      }
    }
  });

  const renderAs = () => {
    const tag = tags().resultTag;
    const rootField = props.result.resultExplore;
    return shouldRenderAs(rootField, tag);
  };

  return (
    <ResultContext.Provider value={metadata()}>
      <Switch fallback={<MalloyTable data={props.result.data} />}>
        <Match when={renderAs() === 'chart'}>
          <Chart
            field={props.result.resultExplore}
            data={metadata().getData(props.result.data)}
            metadata={metadata()}
          />
        </Match>
      </Switch>
    </ResultContext.Provider>
  );
}

// Get the first valid theme value or fallback to CSS variable
function getThemeValue(prop: string, ...themes: Array<Tag | undefined>) {
  let value: string | undefined;
  for (const theme of themes) {
    value = theme?.text(prop);
    if (typeof value !== 'undefined') break;
  }
  // If no theme overrides, convert prop name from camelCase to kebab and pull from --malloy-theme-- variable
  return (
    value ??
    `var(--malloy-theme--${prop
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()})`
  );
}

function generateThemeStyle(modelTheme?: Tag, localTheme?: Tag) {
  const style: Record<string, string> = {};

  const tableRowHeight = getThemeValue(
    'tableRowHeight',
    localTheme,
    modelTheme
  );
  const tableBodyColor = getThemeValue(
    'tableBodyColor',
    localTheme,
    modelTheme
  );
  const tableFontSize = getThemeValue('tableFontSize', localTheme, modelTheme);
  const tableHeaderColor = getThemeValue(
    'tableHeaderColor',
    localTheme,
    modelTheme
  );
  const tableHeaderWeight = getThemeValue(
    'tableHeaderWeight',
    localTheme,
    modelTheme
  );
  const tableBodyWeight = getThemeValue(
    'tableBodyWeight',
    localTheme,
    modelTheme
  );
  const tableBorder = getThemeValue('tableBorder', localTheme, modelTheme);
  const tableBackground = getThemeValue(
    'tableBackground',
    localTheme,
    modelTheme
  );
  const tableGutterSize = getThemeValue(
    'tableGutterSize',
    localTheme,
    modelTheme
  );
  const tablePinnedBackground = getThemeValue(
    'tablePinnedBackground',
    localTheme,
    modelTheme
  );
  const tablePinnedBorder = getThemeValue(
    'tablePinnedBorder',
    localTheme,
    modelTheme
  );
  const fontFamily = getThemeValue('fontFamily', localTheme, modelTheme);

  style['--malloy-render--table-row-height'] = tableRowHeight;
  style['--malloy-render--table-body-color'] = tableBodyColor;
  style['--malloy-render--table-font-size'] = tableFontSize;
  style['--malloy-render--font-family'] = fontFamily;
  style['--malloy-render--table-header-color'] = tableHeaderColor;
  style['--malloy-render--table-header-weight'] = tableHeaderWeight;
  style['--malloy-render--table-body-weight'] = tableBodyWeight;
  style['--malloy-render--table-border'] = tableBorder;
  style['--malloy-render--table-background'] = tableBackground;
  style['--malloy-render--table-gutter-size'] = tableGutterSize;
  style['--malloy-render--table-pinned-background'] = tablePinnedBackground;
  style['--malloy-render--table-pinned-border'] = tablePinnedBorder;
  return style;
}
