import {createContext, useContext} from 'solid-js';
import {TableLayout} from './table-layout';

type TableContext = {
  root: boolean;
  pinnedHeader: boolean;
  layout: TableLayout;
  autoRenameColumns: boolean;
};

export const TableContext = createContext<TableContext>();
export const useTableContext = () => useContext(TableContext);
