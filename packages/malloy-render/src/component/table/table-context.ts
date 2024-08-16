import {createContext, useContext} from 'solid-js';
import {createStore} from 'solid-js/store';
import {TableLayout} from './table-layout';

type TableContext = {
  root: boolean;
  pinnedHeader: boolean;
  layout: TableLayout;
  headerSizeStore: ReturnType<typeof createStore<Record<string, number>>>;
};

export const TableContext = createContext<TableContext>();
export const useTableContext = () => useContext(TableContext);
