import {createStore, produce} from 'solid-js/store';
import {useResultContext} from '../result-context';

export interface BrushData {
  value: string | number | boolean | Date;
  fieldRefId: string;
  sourceId: string;
  type: 'dimension' | 'measure';
}

export interface ResultStoreData {
  brushes: BrushData[];
}

export function createResultStore() {
  const [store, setStore] = createStore<ResultStoreData>({
    brushes: [],
  });

  const getFieldBrushes = (fieldRefId: string, _store?: ResultStoreData) => {
    const localStore = _store ?? store;
    return localStore.brushes.filter(brush => brush.fieldRefId === fieldRefId);
  };

  const getFieldBrushBySourceId = (
    sourceId: string,
    _store?: ResultStoreData
  ) => {
    const localStore = _store ?? store;
    return localStore.brushes.find(b => b.sourceId === sourceId);
  };

  const addFieldBrush = (brush: BrushData) => {
    setStore(
      produce(s => {
        const brushEntry = getFieldBrushBySourceId(brush.sourceId, s);
        if (brushEntry) brushEntry.value = brush.value;
        else {
          s.brushes.push(brush);
        }
      })
    );
  };

  const removeFieldBrush = (sourceId: string) => {
    setStore(
      produce(s => {
        const idx = s.brushes.findIndex(b => b.sourceId === sourceId);
        if (idx !== -1) s.brushes.splice(idx, 1);
      })
    );
  };

  const clearBrushesBySourceId = (sourceId: string) => {
    setStore(
      produce(s => {
        const idx = s.brushes.findIndex(b => b.sourceId === sourceId);
        if (idx !== -1) s.brushes.splice(idx, 1);
      })
    );
  };

  return {
    store,
    getFieldBrushes,
    getFieldBrushBySourceId,
    addFieldBrush,
    removeFieldBrush,
    clearBrushesBySourceId,
  };
}

export type ResultStore = ReturnType<typeof createResultStore>;

export function useResultStore() {
  const metadata = useResultContext();
  return metadata.store;
}
