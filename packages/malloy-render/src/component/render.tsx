/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 *  LICENSE file in the root directory of this source tree.
 */

import {
  ExploreField,
  ModelDef,
  QueryResult,
  Result,
  Tag,
} from '@malloydata/malloy';
import {
  Show,
  createContext,
  createEffect,
  createMemo,
  useContext,
} from 'solid-js';
import {getResultMetadata} from './render-result-metadata';
import {ResultContext} from './result-context';
import './render.css';
import {ComponentOptions, ICustomElement} from 'component-register';
import {applyRenderer} from './apply-renderer';
import {MalloyClickEventPayload, VegaConfigHandler} from './types';

export type MalloyRenderProps = {
  result?: Result;
  queryResult?: QueryResult;
  modelDef?: ModelDef;
  scrollEl?: HTMLElement;
  onClick?: (payload: MalloyClickEventPayload) => void;
  vegaConfigOverride?: VegaConfigHandler;
};

const ConfigContext = createContext<{
  onClick?: (payload: MalloyClickEventPayload) => void;
  vegaConfigOverride?: VegaConfigHandler;
}>();

export const useConfig = () => {
  const config = useContext(ConfigContext);
  if (!config)
    throw new Error(
      'ConfigContext missing a value; did you provide a ConfigProvider?'
    );
  return config;
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
      <ConfigContext.Provider
        value={{
          onClick: props.onClick,
          vegaConfigOverride: props.vegaConfigOverride,
        }}
      >
        <MalloyRenderInner
          result={result()!}
          element={element}
          scrollEl={props.scrollEl}
          vegaConfigOverride={props.vegaConfigOverride}
        />
      </ConfigContext.Provider>
    </Show>
  );
}

export function MalloyRenderInner(props: {
  result: Result;
  element: ICustomElement;
  scrollEl?: HTMLElement;
  vegaConfigOverride?: VegaConfigHandler;
}) {
  const metadata = createMemo(() =>
    getResultMetadata(props.result, {
      getVegaConfigOverride: props.vegaConfigOverride,
    })
  );
  const tags = () => {
    const modelTag = metadata().modelTag;
    const resultTag = metadata().resultTag;
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

  const rendering = () => {
    return applyRenderer({
      // TODO: figure out what to do about the diffs between top level Explore vs. ExploreFields/AtomicFields
      field: props.result.resultExplore as ExploreField,
      dataColumn: props.result.data,
      resultMetadata: metadata(),
      tag: tags().resultTag,
      customProps: {
        table: {
          scrollEl: props.scrollEl,
        },
        dashboard: {
          scrollEl: props.scrollEl,
        },
      },
    });
  };

  return (
    <ResultContext.Provider value={metadata()}>
      {rendering().renderValue}
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
