type ScaleType = 'quantitative' | 'nominal';

export type Channel = {
  fields: string[];
  type: ScaleType | null;
};

export type Mark = {
  id: string;
  type: string; // TODO: narrow for different mark types
  x: string | null;
  y: string | null;
  fill: string | null;
};

export type PlotSpec = {
  x: Channel;
  y: Channel;
  color: Channel;
  fx: Channel;
  fy: Channel;
  marks: Mark[];
};

export function createEmptySpec(): PlotSpec {
  return {
    x: {
      fields: [],
      type: null,
    },
    y: {
      fields: [],
      type: null,
    },
    color: {
      fields: [],
      type: null,
    },
    fx: {
      fields: [],
      type: null,
    },
    fy: {
      fields: [],
      type: null,
    },
    marks: [],
  };
}
