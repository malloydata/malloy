/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {Tag} from '@malloydata/malloy-tag';
import type {Accessor, Setter} from 'solid-js';
import {
  Show,
  createContext,
  createMemo,
  createSignal,
  useContext,
  ErrorBoundary,
} from 'solid-js';
import {getResultMetadata} from './render-result-metadata';
import {MalloyViz} from '@/api/malloy-viz';
import styles from './render.css?raw';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used as a directive in JSX
import {resize} from './util';
import {applyRenderer} from '@/component/renderer/apply-renderer';
import type {
  DashboardConfig,
  DrillData,
  MalloyClickEventPayload,
  TableConfig,
  VegaConfigHandler,
} from './types';
export type {DrillData} from './types';
import type * as Malloy from '@malloydata/malloy-interfaces';
import {getDataTree} from '../data_tree';
import {ResultContext} from './result-context';
import {ErrorMessage} from './error-message/error-message';
import type {RenderFieldMetadata} from '../render-field-metadata';

export type MalloyRenderProps = {
  result?: Malloy.Result;
  element: HTMLElement;
  scrollEl?: HTMLElement;
  modalElement?: HTMLElement;
  onClick?: (payload: MalloyClickEventPayload) => void;
  onDrill?: (drillData: DrillData) => void;
  onError?: (error: Error) => void;
  vegaConfigOverride?: VegaConfigHandler;
  tableConfig?: Partial<TableConfig>;
  dashboardConfig?: Partial<DashboardConfig>;
  renderFieldMetadata: RenderFieldMetadata;
  useVegaInterpreter?: boolean;
};

const ConfigContext = createContext<{
  tableConfig: Accessor<TableConfig>;
  dashboardConfig: Accessor<DashboardConfig>;
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

export function MalloyRender(props: MalloyRenderProps) {
  MalloyViz.addStylesheet(styles);
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
    <ErrorBoundary
      fallback={errorProps => {
        const message = () => errorProps.error?.message ?? errorProps;
        props?.onError?.(errorProps);
        return <ErrorMessage message={message()} />;
      }}
    >
      <Show when={props.result}>
        <ConfigContext.Provider
          value={{
            onClick: props.onClick,
            onDrill: props.onDrill,
            vegaConfigOverride: props.vegaConfigOverride,
            tableConfig,
            dashboardConfig,
            modalElement: props.modalElement,
          }}
        >
          <MalloyRenderInner
            result={props.result!}
            element={props.element}
            scrollEl={props.scrollEl}
            vegaConfigOverride={props.vegaConfigOverride}
            renderFieldMetadata={props.renderFieldMetadata}
            useVegaInterpreter={props.useVegaInterpreter}
          />
        </ConfigContext.Provider>
      </Show>
    </ErrorBoundary>
  );
}
// Prevent charts from growing unbounded as they autofill
const CHART_SIZE_BUFFER = 4;
export function MalloyRenderInner(props: {
  result: Malloy.Result;
  element: HTMLElement;
  scrollEl?: HTMLElement;
  vegaConfigOverride?: VegaConfigHandler;
  renderFieldMetadata: RenderFieldMetadata;
  useVegaInterpreter?: boolean;
}) {
  const [parentSize, setParentSize] = createSignal({
    width: 0,
    height: 0,
  });

  // This is where chart rendering happens for now
  // If size in fill mode, easiest thing would be to just recalculate entire thing
  // This is expensive but we can optimize later to make size responsive
  const rootCell = createMemo(() => {
    return getDataTree(props.result, props.renderFieldMetadata);
  });

  const metadata = createMemo(() => {
    // TODO Do we even need this anymore...
    const resultMetadata = getResultMetadata(rootCell().field, {
      renderFieldMetadata: props.renderFieldMetadata,
      getVegaConfigOverride: props.vegaConfigOverride,
      parentSize: {
        width: parentSize().width - CHART_SIZE_BUFFER,
        height: parentSize().height - CHART_SIZE_BUFFER,
      },
      useVegaInterpreter: props.useVegaInterpreter,
    });
    props.renderFieldMetadata?.getAllFields().forEach(field => {
      const plugins =
        props.renderFieldMetadata?.getPluginsForField(field.key) ?? [];
      plugins.forEach(plugin => {
        plugin.beforeRender?.(resultMetadata, {
          renderFieldMetadata: props.renderFieldMetadata,
          getVegaConfigOverride: props.vegaConfigOverride,
          parentSize: {
            width: parentSize().width - CHART_SIZE_BUFFER,
            height: parentSize().height - CHART_SIZE_BUFFER,
          },
          useVegaInterpreter: props.useVegaInterpreter,
        });
      });
    });
    return resultMetadata;
  });

  // hack to block resize events when we're in fixed mode.
  // TODO as part of plugin system, move sizing strategy into data_tree metadata creation
  const _setParentSize: Setter<{width: number; height: number}> = value => {
    if (metadata().sizingStrategy === 'fixed') return;

    const newSize = typeof value === 'function' ? value(parentSize()) : value;

    setParentSize({
      width: newSize.width - CHART_SIZE_BUFFER,
      height: newSize.height - CHART_SIZE_BUFFER,
    });
  };

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

  const style = () => generateThemeStyle(tags().modelTheme, tags().localTheme);

  const rendering = () => {
    const data = rootCell();

    // Hack to force re-render on resize, since stored in metadata. Would be better to make direct dependency to size
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

  const showRendering = () => {
    if (metadata().sizingStrategy === 'fixed') return true;
    if (
      metadata().sizingStrategy === 'fill' &&
      parentSize().width > 0 &&
      parentSize().height > 0
    ) {
      return true;
    }
    return false;
  };

  return (
    <div
      class="malloy-render"
      style={style()}
      use:resize={[parentSize, _setParentSize]}
    >
      <Show when={showRendering()}>
        <ResultContext.Provider value={metadata}>
          {rendering().renderValue}
        </ResultContext.Provider>
        <Show when={metadata().store.store.showCopiedModal}>
          <div class="malloy-copied-modal">Copied query to clipboard!</div>
        </Show>
      </Show>
    </div>
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

`;
  return css;
}
