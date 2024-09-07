import {createContext, useContext} from 'solid-js';
import {createStore, SetStoreFunction, Store} from 'solid-js/store';
import {TableLayout} from './table-layout';

type TableStore = {
  headerSizes: Record<string, number>;
  columnWidths: Record<string, number>;
};

type TableContext = {
  root: boolean;
  layout: TableLayout;
  store: Store<TableStore>;
  setStore: SetStoreFunction<TableStore>;
  headerSizeStore: ReturnType<typeof createStore<Record<string, number>>>;
};

export const TableContext = createContext<TableContext>();
export const useTableContext = () => useContext(TableContext);
export function createTableStore() {
  return createStore<TableStore>({
    headerSizes: {},
    columnWidths: {},
  });
}
