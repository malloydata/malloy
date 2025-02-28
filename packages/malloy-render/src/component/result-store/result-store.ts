import {createStore, produce, unwrap} from 'solid-js/store';
import {useResultContext} from '../result-context';
import {DrillData, RenderResultMetadata, DimensionContextEntry} from '../types';
import * as Malloy from '@malloydata/malloy-interfaces';

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

interface BrushDataMeasureRange extends BrushDataBase {
  type: 'measure-range';
  value: [number, number];
}

export type BrushData =
  | BrushDataDimension
  | BrushDataMeasure
  | BrushDataMeasureRange;

export type VegaBrushOutput = {
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
  showCopiedModal: boolean;
}

export function createResultStore() {
  const [store, setStore] = createStore<ResultStoreData>({
    brushes: [],
    showCopiedModal: false,
  });

  const getFieldBrushBySourceId = (
    sourceId: string,
    _store?: ResultStoreData
  ) => {
    const localStore = _store ?? store;
    return localStore.brushes.find(b => b.sourceId === sourceId);
  };

  const brushOps: ModifyBrushOp[] = [];
  let processQueued = false;
  const applyBrushOps = (ops: ModifyBrushOp[]) => {
    brushOps.push(...ops);
    if (!processQueued) {
      requestAnimationFrame(() => {
        modifyBrushes(brushOps);
        brushOps.length = 0;
        processQueued = false;
      });
      processQueued = true;
    }
  };

  const areBrushesEqual = (a?: BrushData, b?: BrushData) => {
    return JSON.stringify(unwrap(a)) === JSON.stringify(unwrap(b));
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

  return {
    store,
    applyBrushOps,
    triggerCopiedModal: (time = 2000) => {
      setStore(
        produce(state => {
          state.showCopiedModal = true;
        })
      );
      setTimeout(() => {
        setStore(
          produce(state => {
            state.showCopiedModal = false;
          })
        );
      }, time);
    },
  };
}

export type ResultStore = ReturnType<typeof createResultStore>;

export function useResultStore() {
  const metadata = useResultContext();
  return metadata.store;
}

export async function copyExplorePathQueryToClipboard({
  metadata,
  dimensionContext,
  onDrill,
}: {
  metadata: RenderResultMetadata;
  field: Malloy.DimensionInfo;
  dimensionContext: DimensionContextEntry[];
  onDrill?: (drillData: DrillData) => void;
}) {
  const dimensionContextEntries = dimensionContext;

  // TODO the name is wrong, as it is not the full path; drilling all broken...
  const whereClause = dimensionContextEntries
    .map(entry => `\t\t${entry.field.name} = ${JSON.stringify(entry.value)}`)
    .join(',\n');

  const query = `
run: ${metadata.sourceName} -> {
where:
${whereClause}
} + { select: * }`.trim();

  const drillData: DrillData = {
    dimensionFilters: dimensionContextEntries,
    copyQueryToClipboard: async () => {
      try {
        await navigator.clipboard.writeText(query);
        metadata.store.triggerCopiedModal();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to copy text: ', error);
      }
    },
    query,
    whereClause,
  };
  if (onDrill) onDrill(drillData);
  else await drillData.copyQueryToClipboard();
}
