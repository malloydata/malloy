/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Tag} from '@malloydata/malloy-tag';
import type {Accessor} from 'solid-js';
import {
  Show,
  createContext,
  createEffect,
  createMemo,
  onMount,
  useContext,
} from 'solid-js';
import {getResultMetadata} from './render-result-metadata';
import './render.css';
import type {ComponentOptions, ICustomElement} from 'component-register';
import {applyRenderer} from './apply-renderer';
import type {
  DashboardConfig,
  DrillData,
  MalloyClickEventPayload,
  TableConfig,
  VegaConfigHandler,
} from './types';
export type {DrillData} from './types';
import css from './render.css?raw';
import type * as Malloy from '@malloydata/malloy-interfaces';
import type {ModelDef, QueryResult} from '@malloydata/malloy';
import {Result, API} from '@malloydata/malloy';
import {getDataTree} from '../data_tree';
import {ResultContext} from './result-context';
import {createRAFSignal} from './util';
import {LineChartSeriesPluginFactory} from '../plugins/line-chart-series-plugin';

export type MalloyRenderProps = {
  malloyResult?: Malloy.Result;
  result?: Result;
  queryResult?: QueryResult;
  modelDef?: ModelDef;
  scrollEl?: HTMLElement;
  modalElement?: HTMLElement;
  onClick?: (payload: MalloyClickEventPayload) => void;
  onDrill?: (drillData: DrillData) => void;
  vegaConfigOverride?: VegaConfigHandler;
  tableConfig?: Partial<TableConfig>;
  dashboardConfig?: Partial<DashboardConfig>;
};

type MalloyRenderApiState = {
  sizingStrategy: 'fill' | 'fixed';
  renderAs: string;
};

export type MalloyRenderApi = {
  onInitialState?: (state: MalloyRenderApiState) => void;
  __experimental: MalloyRenderApiState;
};

export type MalloyCustomElement = HTMLElement &
  ICustomElement &
  MalloyRenderProps &
  MalloyRenderApi;

const ConfigContext = createContext<{
  tableConfig: Accessor<TableConfig>;
  dashboardConfig: Accessor<DashboardConfig>;
  element: MalloyCustomElement;
  stylesheet: CSSStyleSheet;
  addCSSToShadowRoot: (css: string) => void;
  addCSSToDocument: (id: string, css: string) => void;
  onClick?: (payload: MalloyClickEventPayload) => void;
  onDrill?: (drillData: DrillData) => void;
  vegaConfigOverride?: VegaConfigHandler;
  modalElement?: HTMLElement;
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
  const malloyRenderElement = element as MalloyCustomElement;

  const result = createMemo(() => {
    if (props.malloyResult) {
      return props.malloyResult;
    }
    const result =
      props.result ??
      (props.queryResult && props.modelDef
        ? new Result(props.queryResult, props.modelDef)
        : null);
    if (result) {
      return API.util.wrapResult(result);
    }
    return null;
  });

  // Create one stylesheet for web component to use for all styles
  // This is so we can pass the stylesheet to other components to share, like <malloy-modal>
  const stylesheet = new CSSStyleSheet();
  if (malloyRenderElement.renderRoot instanceof ShadowRoot)
    malloyRenderElement.renderRoot.adoptedStyleSheets.push(stylesheet);

  const addedStylesheets = new Set();
  function addCSSToShadowRoot(css: string) {
    const root = element.renderRoot;
    if (!(root instanceof ShadowRoot)) {
      // eslint-disable-next-line no-console
      console.warn(
        "Couldn't add CSS to render element, it is not rendering in a ShadowRoot"
      );
      return;
    }
    if (!addedStylesheets.has(css)) {
      const newStyleSheetTexts: string[] = [];
      for (let i = 0; i < stylesheet.cssRules.length; i++) {
        const cssText = stylesheet.cssRules.item(i)?.cssText;
        if (cssText) newStyleSheetTexts.push(cssText);
      }
      newStyleSheetTexts.push(css);
      stylesheet.replaceSync(newStyleSheetTexts.join('\n'));
      addedStylesheets.add(css);
    }
  }

  function addCSSToDocument(id: string, css: string) {
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = css;
      document.head.appendChild(style);
    }
  }

  addCSSToShadowRoot(css);

  const tableConfig: Accessor<TableConfig> = () =>
    Object.assign(
      {
        disableVirtualization: false,
        rowLimit: Infinity,
        shouldFillWidth: false,
        enableDrill: false,
      },
      props.tableConfig
    );

  const dashboardConfig: Accessor<DashboardConfig> = () =>
    Object.assign(
      {
        disableVirtualization: false,
      },
      props.dashboardConfig
    );

  return (
    <Show when={result()}>
      <ConfigContext.Provider
        value={{
          onClick: props.onClick,
          onDrill: props.onDrill,
          vegaConfigOverride: props.vegaConfigOverride,
          element: malloyRenderElement,
          stylesheet,
          addCSSToShadowRoot,
          addCSSToDocument,
          tableConfig,
          dashboardConfig,
          modalElement: props.modalElement,
        }}
      >
        <MalloyRenderInner
          result={result()!}
          element={malloyRenderElement}
          scrollEl={props.scrollEl}
          vegaConfigOverride={props.vegaConfigOverride}
        />
      </ConfigContext.Provider>
    </Show>
  );
}
// Prevent charts from growing unbounded as they autofill
const CHART_SIZE_BUFFER = 4;
export function MalloyRenderInner(props: {
  result: Malloy.Result;
  element: MalloyCustomElement;
  scrollEl?: HTMLElement;
  vegaConfigOverride?: VegaConfigHandler;
}) {
  const wrapper = props.element['parentElement'];
  if (!wrapper) {
    throw new Error('Malloy render: Parent element not found');
  }
  const [parentSize, setParentSize] = createRAFSignal({
    width: wrapper.clientWidth - CHART_SIZE_BUFFER,
    height: wrapper.clientHeight - CHART_SIZE_BUFFER,
  });
  const o = new ResizeObserver(entries => {
    const {width, height} = entries[0].contentRect;
    if (width !== parentSize().width || height !== parentSize().height) {
      setParentSize({
        width: width - CHART_SIZE_BUFFER,
        height: height - CHART_SIZE_BUFFER,
      });
    }
  });

  o.observe(wrapper);

  // This is where chart rendering happens for now
  // If size in fill mode, easiest thing would be to just recalculate entire thing
  // This is expensive but we can optimize later to make size responsive
  const rootCell = createMemo(() =>
    getDataTree(props.result, [LineChartSeriesPluginFactory])
  );

  const metadata = createMemo(() =>
    getResultMetadata(rootCell(), {
      getVegaConfigOverride: props.vegaConfigOverride,
      parentSize: parentSize(),
    })
  );
  const tags = () => {
    const modelTag = rootCell().field.modelTag;
    const resultTag = rootCell().field.tag;
    const modelTheme = modelTag.tag('theme');
    const localTheme = resultTag.tag('theme');
    return {
      modelTag,
      resultTag,
      modelTheme,
      localTheme,
    };
  };

  const config = useConfig();

  createEffect(() => {
    if (props.element) {
      const style = generateThemeStyle(tags().modelTheme, tags().localTheme);
      config.addCSSToShadowRoot(style);
    }
  });

  const rendering = () => {
    const data = rootCell();
    // TODO hack: forcing re-render based on metadata. Fix this; result context should return a reactive store probably
    //  that store is where we can store the size info, probably
    metadata();
    return applyRenderer({
      dataColumn: data,
      tag: data.field.tag,
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

  onMount(() => {
    props.element.__experimental = {
      sizingStrategy: metadata().sizingStrategy,
      renderAs: metadata().renderAs,
    };
    props.element.onInitialState?.(props.element.__experimental);
  });

  return (
    <>
      <ResultContext.Provider value={metadata}>
        {rendering().renderValue}
      </ResultContext.Provider>
      <Show when={metadata().store.store.showCopiedModal}>
        <div class="malloy-copied-modal">Copied query to clipboard!</div>
      </Show>
    </>
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

  const css = `
  :host {
    --malloy-render--table-row-height: ${tableRowHeight};
    --malloy-render--table-body-color: ${tableBodyColor};
    --malloy-render--table-font-size: ${tableFontSize};
    --malloy-render--font-family: ${fontFamily};
    --malloy-render--table-header-color: ${tableHeaderColor};
    --malloy-render--table-header-weight: ${tableHeaderWeight};
    --malloy-render--table-body-weight: ${tableBodyWeight};
    --malloy-render--table-border: ${tableBorder};
    --malloy-render--table-background: ${tableBackground};
    --malloy-render--table-gutter-size: ${tableGutterSize};
    --malloy-render--table-pinned-background: ${tablePinnedBackground};
    --malloy-render--table-pinned-border: ${tablePinnedBorder};
  }
`;
  return css;
}
