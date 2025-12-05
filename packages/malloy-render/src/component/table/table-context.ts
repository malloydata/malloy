import {createContext, useContext} from 'solid-js';
import type {SetStoreFunction, Store} from 'solid-js/store';
import {createStore} from 'solid-js/store';
import type {TableLayout} from './table-layout';
import type {PivotConfig} from './pivot-utils';

type TableStore = {
  headerSizes: Record<string, number>;
  columnWidths: Record<string, number>;
  highlightedRow: number[] | null;
  highlightedExplore: string[] | null;
  showCopiedModal: boolean;
};

export type TableContext = {
  root: boolean;
  layout: TableLayout;
  store: Store<TableStore>;
  setStore: SetStoreFunction<TableStore>;
  headerSizeStore: ReturnType<typeof createStore<Record<string, number>>>;
  currentRow: number[];
  currentExplore: string[];
  /** Map of field key to pivot configuration */
  pivotConfigs: Map<string, PivotConfig>;
};

export const TableContext = createContext<TableContext>();
export const useTableContext = () => useContext(TableContext);
export function createTableStore() {
  return createStore<TableStore>({
    headerSizes: {},
    columnWidths: {},
    highlightedRow: null,
    highlightedExplore: null,
    showCopiedModal: false,
  });
}
