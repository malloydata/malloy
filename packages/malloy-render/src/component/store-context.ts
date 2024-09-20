import {Context, createContext, useContext} from 'solid-js';
import {createStore, SetStoreFunction} from 'solid-js/store';

type RenderStore = {
  interactions: {
    type: 'hover';
    field: string;
    value: unknown;
    source: string;
  }[];
};

export const createRenderStore = () =>
  createStore<RenderStore>({interactions: []});

export const StoreContext: Context<
  [get: RenderStore, set: SetStoreFunction<RenderStore>] | undefined
> = createContext();

export const useStore = () => {
  const store = useContext(StoreContext);
  if (!store)
    throw Error('useStore must be used within a StoreContext.Provider');
  return store;
};
