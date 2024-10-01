import {createStore, produce} from 'solid-js/store';
import {useResultContext} from '../result-context';

export interface BrushData {
  value: string | number | boolean | Date;
  id: string;
}

export interface ResultStoreData {
  brushes: Record<string, BrushData[]>;
  // TODO: measure references
  // references: ...
}

export function createResultStore() {
  const [store, setStore] = createStore<ResultStoreData>({
    brushes: {},
  });

  const getFieldBrushes = (fieldName: string, _store?: ResultStoreData) => {
    const localStore = _store ?? store;
    if (!localStore.brushes[fieldName]) localStore.brushes[fieldName] = [];
    return localStore.brushes[fieldName]!;
  };

  const getFieldBrushById = (
    fieldName: string,
    id: string,
    _store?: ResultStoreData
  ) => {
    return getFieldBrushes(fieldName, _store).find(b => b.id === id);
  };

  const addFieldBrush = (fieldName: string, brush: BrushData) => {
    setStore(
      produce(s => {
        const brushEntry = getFieldBrushById(fieldName, brush.id, s);
        if (brushEntry) brushEntry.value = brush.value;
        else {
          const brushes = getFieldBrushes(fieldName, s);
          brushes.push(brush);
        }
      })
    );
  };

  const removeFieldBrush = (fieldName: string, id: string) => {
    setStore(
      produce(s => {
        const brushes = getFieldBrushes(fieldName, s);
        const idx = brushes.findIndex(b => b.id === id);
        if (idx !== -1) brushes.splice(idx, 1);
      })
    );
  };

  const clearBrushesById = (id: string) => {
    setStore(
      produce(s => {
        Object.entries(s.brushes).forEach(([fieldName, brushes]) => {
          const idx = brushes.findIndex(b => b.id === id);
          if (idx !== -1) brushes.splice(idx, 1);
        });
      })
    );
  };

  return {
    store,
    getFieldBrushes,
    getFieldBrushById,
    addFieldBrush,
    removeFieldBrush,
    clearBrushesById,
  };
}

export type ResultStore = ReturnType<typeof createResultStore>;

export function useResultStore() {
  const metadata = useResultContext();
  return metadata.store;
}
