import Any from './any';
import {Spec} from './parse-plot-tags';

const grayMedium = '#727883';
const gridGray = '#E5E7EB';

export function plotToVega(spec: Spec) {
  const vgSpec: Any = {
    '$schema': 'https://vega.github.io/schema/vega/v5.json',
    width: 400,
    height: 200,
    config: {
      axisY: {
        gridColor: gridGray,
        tickColor: gridGray,
        domain: false,
        labelFont: 'Inter, sans-serif',
        labelFontSize: 10,
        labelFontWeight: 'normal',
        labelColor: grayMedium,
        labelPadding: 5,
        titleColor: grayMedium,
        titleFont: 'Inter, sans-serif',
        titleFontSize: 12,
        titleFontWeight: 'bold',
        titlePadding: 10,
        labelOverlap: false,
      },
      axisX: {
        gridColor: gridGray,
        tickColor: gridGray,
        tickSize: 0,
        domain: false,
        labelFont: 'Inter, sans-serif',
        labelFontSize: 10,
        labelFontWeight: 'normal',
        labelPadding: 5,
        labelColor: grayMedium,
        titleColor: grayMedium,
        titleFont: 'Inter, sans-serif',
        titleFontSize: 12,
        titleFontWeight: 'bold',
        titlePadding: 10,
      },
      view: {
        strokeWidth: 0,
      },
    },
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

  // Setup lists as data
  for (const [id, list] of Object.entries<Any>(spec.lists)) {
    vgSpec.data.push({
      name: `list_${id}`,
      values: list.map(l => ({
        value: l.eq,
      })),
    });
  }

  // use spec.x/y.fields to look up all data for x axis
  const xScale: Any = {
    name: 'xscale',
    type: spec.x.type === 'nominal' ? 'band' : 'linear', // TODO: when to use band vs point? depending on marks? how to mix and match?
    // TODO: manually derive domain from data, allow blended fields, etc
    domain: {data: 'table', field: spec.x.fields.at(0)},
    range: 'width',
  };

  if (xScale.type === 'band') {
    xScale.padding = 0.2;
    xScale.round = true;
  }

  const yScale: Any = {
    name: 'yscale',
    type: spec.y.type === 'nominal' ? 'band' : 'linear',
    // TODO: manually derive domain from data, allow blended fields, etc. And how to do this from transformations like stacks?
    // may be able to do it in vega data transforms, although I don't love it
    domain: {data: 'table', fields: spec.y.fields},
    range: 'height',
  };
  if (yScale.type === 'linear') {
    yScale.nice = true;
  }

  const colorScale: Any = {
    name: 'color',
    type: 'ordinal', // TODO: support other color scale types
    range: ['#4FA8BF', '#EDB74A', '#CC6F33'], // 'category',
    // TODO: manually derive domain from data, allow blended fields, etc
    domain: {data: 'table', field: spec.color.fields.at(0)},
  };

  vgSpec.scales.push(xScale);
  vgSpec.scales.push(yScale);

  const hasColorField = spec.color.fields.at(0);
  const hasColorList = spec.color.lists.length > 0;
  if (hasColorField) {
    vgSpec.scales.push(colorScale);
    vgSpec.legends.push({
      fill: 'color',
      title: spec.color.fields.at(0),
    });
  } else if (hasColorList) {
    colorScale.domain = {data: `list_${spec.color.lists[0]}`, field: 'value'};
    vgSpec.scales.push(colorScale);
    vgSpec.legends.push({
      fill: 'color',
      title: spec.color.lists[0],
    });
  }

  // If chart is faceting, create a facet layer first
  const fxField = spec.fx.fields.at(0);
  let groupMark: Any;
  const xIsList = spec.x.lists.length > 0;
  if (fxField) {
    xScale.domain.field = fxField;
    let innerDomain: Any = {data: 'table', field: spec.x.fields.at(0)};
    if (xIsList) {
      innerDomain = {
        data: `list_${spec.x.lists[0]}`,
        field: 'value',
      };
    }

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
          domain: innerDomain,
          // domain: ['avgRetail', 'medianRetail'],
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
    const yListId = mark.yList;
    if (yListId) {
      const yList = spec.lists[yListId].map(l => l.eq);
      // HACK, the parse-plot-tags function should be doing this
      const yScale = vgSpec.scales.find(s => s.name === 'yscale');
      if (yScale) yScale.domain.fields.push(...yList);
      const datasets: Any[] = [];
      yList.forEach((yField, i) => {
        datasets.push({
          name: `list_${yListId}_${mark.id}_${i}`,
          source: 'table', // or facet...
          transform: [
            {
              type: 'formula',
              as: 'listValue',
              expr: `"${yField}"`,
            },
            {
              type: 'formula',
              as: 'listValueOfField',
              expr: `datum["${yField}"]`,
            },
          ],
        });
      });
      datasets.push({
        name: `list_${yListId}_${mark.id}`,
        source: datasets.map(d => d.name),
      });
      vgSpec.data.push(...datasets);

      // markData.source = `list_${yListId}_${mark.id}`;
    }
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
        source: yListId ? `list_${yListId}_${mark.id}` : 'table',
        transform: [],
      };
      vgSpec.data.push(markData);
    }

    // MORE HACKS
    if (groupMark && yListId) {
      groupMark.from.facet.data = `list_${yListId}_${mark.id}`;
    }

    let xField = mark.x ?? spec.x.fields.at(0);
    if (xIsList) xField = 'listValue';

    // Set up data with any necessary transforms

    if (mark.type === 'barY') {
      // if has a z, then we need to stack it
      if (mark.z) {
        markData.transform.push({
          type: 'stack',
          groupby: [xField],
          field: yListId ? 'listValueOfField' : mark.y ?? spec.y.fields.at(0),
          sort: {field: mark.z},
        });
      }
      vgMark.type = 'rect';
      vgMark.from = {data: mark.id};
      const xScaleName = groupMark ? 'pos' : 'xscale';
      vgMark.encode = {
        enter: {
          x: {scale: xScaleName, field: xField},
          // width: {value: 20},
          width: {scale: xScaleName, band: 1},
          y: {scale: 'yscale', field: mark.y ?? spec.y.fields.at(0)},
          y2: {'scale': 'yscale', 'value': 0},
          fill: mark.fill
            ? {field: mark.fill, scale: 'color'}
            : {value: '#4FA8BF'},
          // fillOpacity: {value: 0.5},
        },
      };
      if (yListId) {
        vgMark.encode.enter.y = {
          signal: "scale('yscale', datum[datum.listValue])",
        };
      }
      if (mark.fillList) {
        vgMark.encode.enter.fill = {
          field: 'listValue',
          scale: 'color',
        };
      }
      if (mark.z) {
        vgMark.encode.enter.y = {
          scale: 'yscale',
          field: 'y0',
        };
        vgMark.encode.enter.y2 = {
          scale: 'yscale',
          field: 'y1',
        };
        if (!fxField) yScale.domain.fields.push({data: mark.id, field: 'y1'});
      }
    }
  }

  vgSpec.axes.push({
    orient: 'bottom',
    scale: 'xscale',
    titlePadding: 8,
    title:
      spec.fx.fields.length > 0
        ? spec.fx.fields.join(', ')
        : spec.x.fields.join(', '),
  });
  vgSpec.axes.push({
    orient: 'left',
    scale: 'yscale',
    grid: true,
    tickCount: 4,
    titlePadding: 8,
    title: [...new Set(yScale.domain.fields)]
      .filter(s => typeof s === 'string')
      .join(', '), // spec.y.fields.join(', '),
  });

  return vgSpec;
}
