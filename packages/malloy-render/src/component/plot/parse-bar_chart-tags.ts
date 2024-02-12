import {Result, Field, Tag, Explore} from '@malloydata/malloy';
import {Spec, getFieldPathFromRoot, walkFields} from './parse-plot-tags';
import Any from './any';

export function parseBarChartTags(result: Result) {
  const {tag} = result.tagParse();
  const chart = tag.tag('bar_chart');
  if (!chart) {
    // Throw error?
    throw new Error('No bar_chart tag found');
  }

  const spec: Spec = {
    x: {
      fields: chart.text('x') ? [chart.text('x')] : [],
      type: 'nominal', // chart.text('x', 'type') ?? null,
      lists: [],
    },
    y: {
      fields: chart.text('y') ? [chart.text('y')] : [],
      type: 'quantitative', // chart.text('y', 'type') ?? null,
      lists: [],
    },
    color: {
      fields: [],
      type: chart.text('color', 'type') ?? null,
      lists: [],
    },
    fx: {
      fields: [],
      type: 'nominal',
    },
    fy: {
      fields: [],
    },
    marks: [
      {
        type: 'barY',
        y: null,
        yList: null,
        x: null,
        id: 'b',
        z: null,
        fill: null,
        fillList: null,
      },
    ],
    lists: {
      l: [],
    },
  };

  // if chart.y is array, make list
  if (chart.array('y')) {
    spec.lists.l.push(...chart.array('y')!);
    if (!spec.y.lists.includes('l')) {
      spec.y.lists.push('l');
    }
  }

  // find embedded x / y's
  const embeddedX: string[] = [];
  const embeddedY: string[] = [];
  const embeddedSplit: string[] = [];
  walkFields(result.resultExplore, field => {
    const {tag} = field.tagParse();
    if (tag.has('x')) {
      embeddedX.push(getFieldPathFromRoot(field));
    }
    if (tag.has('y')) {
      embeddedY.push(getFieldPathFromRoot(field));
    }
    if (tag.has('split')) {
      embeddedSplit.push(getFieldPathFromRoot(field));
    }
  });

  embeddedX.forEach(path => {
    spec.x.fields.push(path);
  });

  if (embeddedY.length > 1) {
    const listId = 'l';
    if (!spec.y.lists.includes(listId)) {
      spec.y.lists.push(listId);
    }
    embeddedY.forEach(path => {
      spec.lists.l.push(Tag.tagFrom({eq: path}));
    });
  } else if (embeddedY.at(0)) {
    spec.y.fields.push(embeddedY.at(0));
  }

  const split = chart.text('split') ?? embeddedSplit.at(0);
  const isStack = chart.has('stack');
  const isGroup = split;

  // console.log()

  // if x and y still empty, pick first fields
  if (spec.x.fields.length === 0) {
    const stringFields = result.resultExplore.allFields.filter(
      f => f.isAtomicField() && f.isString()
    );
    if (stringFields.length === 1) {
      spec.x.fields.push(stringFields[0].name);
    } else if (stringFields.length > 1) {
      if (isStack) {
        spec.x.fields.push(stringFields[0].name);
      } else {
        spec.fx.fields.push(stringFields[0].name);
        spec.x.fields.push(stringFields[1].name);
      }

      spec.color.fields.push(stringFields[1].name);
      spec.marks[0].fill = stringFields[1].name;
      spec.marks[0].z = stringFields[1].name;
    }
  }
  if (spec.y.fields.length === 0) {
    const numberField = result.resultExplore.allFields.find(
      f => f.isAtomicField() && f.isNumber()
    );
    if (numberField) spec.y.fields.push(numberField.name);
  }

  // stack / split tags

  if (isGroup && !isStack) {
    spec.fx.fields.push(spec.x.fields[0]);
    spec.x.fields[0] = split; // chart.text('split');
    spec.marks[0].fill = spec.x.fields[0];
    spec.marks[0].z = spec.x.fields[0];
    spec.color.fields.push(spec.x.fields[0]);
  }
  if (isGroup && isStack) {
    // spec.fx.fields.push(chart.text('split'));
    spec.marks[0].fill = split; // chart.text('split');
    spec.marks[0].z = split; // chart.text('split');
    spec.color.fields.push(split); // chart.text('split'));
  }

  // Update the mark
  if (spec.y.lists.length > 0) {
    spec.marks[0].yList = 'l';
    spec.marks[0].fillList = 'l';
    spec.color.lists.push('l');
    if (!isStack) {
      spec.fx.fields = spec.x.fields;
      spec.x.fields = [];
      spec.x.lists.push('l');
    } else {
      spec.marks[0].z = 'listValue';
    }
  } else {
    spec.marks[0].y = spec.y.fields[0];
  }

  return spec;
}
