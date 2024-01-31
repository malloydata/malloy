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
    // TODO: manually derive domain from data, allow blended fields, etc
    domain: {data: 'table', field: spec.y.fields.at(0)},
    range: 'height',
  };
  if (yScale.type === 'linear') {
    yScale.nice = true;
  }

  vgSpec.scales.push(xScale);
  vgSpec.scales.push(yScale);
  vgSpec.axes.push({orient: 'bottom', scale: 'xscale'});
  vgSpec.axes.push({orient: 'left', scale: 'yscale'});

  for (const mark of spec.marks) {
    const vgMark: Any = {};
    vgSpec.marks.push(vgMark);
    if (mark.type === 'barY') {
      vgMark.type = 'rect';
      vgMark.from = {data: 'table'};
      vgMark.encode = {
        enter: {
          x: {scale: 'xscale', field: mark.x ?? spec.x.fields.at(0)},
          width: {scale: 'xscale', band: 1},
          y: {scale: 'yscale', field: mark.y ?? spec.y.fields.at(0)},
          y2: {'scale': 'yscale', 'value': 0},
          fill: {value: 'steelblue'},
        },
      };
    }
  }

  return vgSpec;
}
