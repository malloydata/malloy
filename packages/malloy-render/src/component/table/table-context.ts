import {createContext, useContext} from 'solid-js';
import {createStore, SetStoreFunction, Store} from 'solid-js/store';
import {TableLayout} from './table-layout';
import {Explore, Field} from '@malloydata/malloy';

type TableStore = {
  headerSizes: Record<string, number>;
  columnWidths: Record<string, number>;
  highlightedRow: number[] | null;
  highlightedExplore: string[] | null;
  showCopiedModal: boolean;
};

export type DimensionContextEntry = {
  fieldDef: string;
  value: string | number | boolean | Date;
};

export type TableContext = {
  root: boolean;
  layout: TableLayout;
  store: Store<TableStore>;
  setStore: SetStoreFunction<TableStore>;
  headerSizeStore: ReturnType<typeof createStore<Record<string, number>>>;
  currentRow: number[];
  currentExplore: string[];
  dimensionContext: DimensionContextEntry[];
  copyExplorePathQueryToClipboard: (
    tableCtx: TableContext,
    field: Field,
    dimensionContext: DimensionContextEntry[]
  ) => void;
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

export async function copyExplorePathQueryToClipboard(
  tableCtx: TableContext,
  field: Field,
  dimensionContext: DimensionContextEntry[]
) {
  const dimensionContextEntries = [
    ...tableCtx!.dimensionContext,
    ...dimensionContext,
  ];
  let explore: Field | Explore = field;
  while (explore.parentExplore) {
    explore = explore.parentExplore;
  }

  const whereClause = dimensionContextEntries
    .map(entry => `\t\t${entry.fieldDef} is ${JSON.stringify(entry.value)}`)
    .join(',\n');

  const query = `
run: ${explore.name} -> {
where:
${whereClause}
} + { select: * }`.trim();

  try {
    await navigator.clipboard.writeText(query);
    tableCtx.setStore(s => ({
      ...s,
      showCopiedModal: true,
    }));
    setTimeout(() => {
      tableCtx.setStore(s => ({
        ...s,
        showCopiedModal: false,
      }));
    }, 2000);
  } catch (error) {
    console.error('Failed to copy text: ', error);
  }
}
