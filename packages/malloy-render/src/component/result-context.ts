import {createContext, useContext} from 'solid-js';
import {RenderResultMetadata} from './types';

export const ResultContext = createContext<RenderResultMetadata>();
export const useResultContext = () => {
  const ctx = useContext(ResultContext);
  if (!ctx)
    throw Error(
      'useResultContext must be used within a ResultContext.Provider'
    );
  return ctx;
};
