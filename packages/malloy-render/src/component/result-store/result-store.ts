import {createStore, produce} from 'solid-js/store';
import {useResultContext} from '../result-context';
import {createEffect} from 'solid-js';

interface BrushDataBase {
  fieldRefId: string;
  sourceId: string;
}

interface BrushDataDimension extends BrushDataBase {
  type: 'dimension';
  value: (string | number | boolean | Date)[];
}

interface BrushDataMeasure extends BrushDataBase {
  type: 'measure';
  value: number[];
}

export interface ModifyBrushOp {
  type: 'add' | 'remove';
  sourceId: string;
  value?: BrushData;
}

// This doesn't really make sense if you want to support ranges and ref lines at the same time.
// which maybe you don't. instead, you could have BrushDataMeasure with sig like value: {type: "point", "range", value: number | [number, number]}[]
interface BrushDataMeasureRange extends BrushDataBase {
  type: 'measure-range';
  value: [number, number];
}

export type BrushData =
  | BrushDataDimension
  | BrushDataMeasure
  | BrushDataMeasureRange;

export type VegaBrushOut = {
  sourceId: string;
  data: BrushData | null;
  debounce?:
    | number
    | {
        time?: number;
        strategy?: 'always' | 'on-empty';
      };
};

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

  const brushOps: ModifyBrushOp[] = [];
  let processQueued = false;
  const processBrushOps = (ops: ModifyBrushOp[]) => {
    brushOps.push(...ops);
    if (!processQueued) {
      // setTimeout(() => {
      //   modifyBrushes(brushOps);
      //   brushOps.length = 0;
      //   processQueued = false;
      // }, 0);
      requestAnimationFrame(() => {
        modifyBrushes(brushOps);
        brushOps.length = 0;
        processQueued = false;
      });
      processQueued = true;
    }
  };

  const areBrushesEqual = (a?: BrushData, b?: BrushData) => {
    // TODO: probably need to do manual checks so we can handle data types like Dates
    return JSON.stringify(a) === JSON.stringify(b);
  };

  const modifyBrushes = (ops: ModifyBrushOp[]) => {
    setStore(
      produce(state => {
        ops.forEach(op => {
          if (op.type === 'add') {
            const brushEntry = getFieldBrushBySourceId(
              op.value!.sourceId,
              state
            );
            // Do equality check before processing
            if (brushEntry) {
              if (!areBrushesEqual(brushEntry, op.value))
                Object.assign(brushEntry, op.value);
            } else {
              state.brushes.push(op.value!);
            }
          } else if (op.type === 'remove') {
            const idx = state.brushes.findIndex(
              b => b.sourceId === op.sourceId
            );
            if (idx !== -1) state.brushes.splice(idx, 1);
          }
        });
      })
    );
  };

  const addFieldBrush = (brush: BrushData) => {
    setStore(
      produce(s => {
        const brushEntry = getFieldBrushBySourceId(brush.sourceId, s);
        if (brushEntry) Object.assign(brushEntry, brush);
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

  // createEffect(() => {
  //   console.count('store changed');
  //   console.log(JSON.stringify(store, null, 2));
  // });

  return {
    store,
    getFieldBrushes,
    getFieldBrushBySourceId,
    addFieldBrush,
    removeFieldBrush,
    modifyBrushes,
    clearBrushesBySourceId,
    processBrushOps,
  };
}

export type ResultStore = ReturnType<typeof createResultStore>;

export function useResultStore() {
  const metadata = useResultContext();
  return metadata.store;
}
