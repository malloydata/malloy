import Any from './any';
import {Spec} from './parse-plot-tags';
export function plotToVega(spec: Spec) {
  const vgSpec: Any = {
    '$schema': 'https://vega.github.io/schema/vega/v5.json',
    width: 400,
    height: 200,
    data: [
      {
        name: 'table',
        values: [],
      },
    ],
    marks: [],
    scales: [],
    legends: [],
    axes: [],
  };

  // use spec.x/y.fields to look up all data for x axis
  const xScale: Any = {
    name: 'xscale',
    type: spec.x.type === 'nominal' ? 'band' : 'linear', // TODO: when to use band vs point? depending on marks? how to mix and match?
    // TODO: manually derive domain from data, allow blended fields, etc
    domain: {data: 'table', field: spec.x.fields.at(0)},
    range: 'width',
  };

  if (xScale.type === 'band') {
    xScale.padding = 0.05;
    xScale.round = true;
  }

  const yScale: Any = {
    name: 'yscale',
    type: spec.y.type === 'nominal' ? 'band' : 'linear',
    // TODO: manually derive domain from data, allow blended fields, etc. And how to do this from transformations like stacks?
    // may be able to do it in vega data transforms, although I don't love it
    domain: {data: 'table', field: spec.y.fields.at(0)},
    range: 'height',
  };
  if (yScale.type === 'linear') {
    yScale.nice = true;
  }

  const colorScale: Any = {
    name: 'color',
    type: 'ordinal', // TODO: support other color scale types
    range: 'category',
    // TODO: manually derive domain from data, allow blended fields, etc
    domain: {data: 'table', field: spec.color.fields.at(0)},
  };

  vgSpec.scales.push(xScale);
  vgSpec.scales.push(yScale);

  if (spec.color.fields.at(0)) {
    vgSpec.scales.push(colorScale);
    vgSpec.legends.push({
      fill: 'color',
      title: spec.color.fields.at(0),
    });
  }

  vgSpec.axes.push({orient: 'bottom', scale: 'xscale'});
  vgSpec.axes.push({orient: 'left', scale: 'yscale'});

  // If chart is faceting, create a facet layer first
  const fxField = spec.fx.fields.at(0);
  let groupMark: Any;
  if (fxField) {
    xScale.domain.field = fxField;

    groupMark = {
      type: 'group',
      from: {
        facet: {
          data: 'table',
          name: 'facet',
          groupby: fxField,
        },
      },
      data: [],
      encode: {
        enter: {
          x: {scale: 'xscale', field: fxField},
        },
      },
      signals: [{name: 'width', 'update': "bandwidth('xscale')"}],
      scales: [
        {
          name: 'pos',
          type: 'band',
          range: 'width',
          paddingOuter: 0.2,
          // Make sure to share domain here
          domain: {data: 'table', field: spec.x.fields.at(0)},
        },
      ],
      marks: [],
    };
  }

  if (groupMark) {
    vgSpec.marks.push(groupMark);
  }

  for (const mark of spec.marks) {
    const vgMark: Any = {};
    let markData: Any;
    if (groupMark) {
      groupMark.marks.push(vgMark);
      markData = {
        name: mark.id,
        source: 'facet',
        transform: [],
      };
      groupMark.data.push(markData);
    } else {
      vgSpec.marks.push(vgMark);
      markData = {
        name: mark.id,
        source: 'table',
        transform: [],
      };
      vgSpec.data.push(markData);
    }

    // Set up data with any necessary transforms

    if (mark.type === 'barY') {
      // if has a z, then we need to stack it
      if (mark.z) {
        markData.transform.push({
          type: 'stack',
          groupby: [mark.x ?? spec.x.fields.at(0)],
          field: mark.y ?? spec.y.fields.at(0),
          sort: {field: mark.z},
        });
      }
      vgMark.type = 'rect';
      vgMark.from = {data: mark.id};
      const xScaleName = groupMark ? 'pos' : 'xscale';
      vgMark.encode = {
        enter: {
          x: {scale: xScaleName, field: mark.x ?? spec.x.fields.at(0)},
          width: {scale: xScaleName, band: 1},
          y: {scale: 'yscale', field: mark.y ?? spec.y.fields.at(0)},
          y2: {'scale': 'yscale', 'value': 0},
          fill: mark.fill
            ? {field: mark.fill, scale: 'color'}
            : {value: 'steelblue'},
          // fillOpacity: {value: 0.5},
        },
      };
      if (mark.z) {
        vgMark.encode.enter.y.field = 'y0';
        vgMark.encode.enter.y2.field = 'y1';
      }
    }
  }

  return vgSpec;
}
