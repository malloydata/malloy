import {Explore, Tag} from '@malloydata/malloy';
import {Mark, PlotSpec, createEmptySpec} from '../plot/plot-spec';
import {getFieldPathBetweenFields, walkFields} from '../plot/util';

export function generateBarChartSpec(
  explore: Explore,
  tagOverride?: Tag
): PlotSpec {
  const tag = tagOverride ?? explore.tagParse().tag;
  const chart = tag.tag('bar_chart') ?? tag.tag('bar');
  if (!chart) {
    throw new Error(
      'Tried to render a bar_chart, but no bar_chart tag was found'
    );
  }

  const spec = createEmptySpec();

  // Parse top level tags
  if (chart.text('x')) {
    spec.x.fields.push(chart.text('x')!);
  }
  if (chart.text('y')) {
    spec.y.fields.push(chart.text('y')!);
  }

  // Parse embedded tags
  const embeddedX: string[] = [];
  const embeddedY: string[] = [];
  walkFields(explore, field => {
    const {tag} = field.tagParse();
    if (tag.has('x')) {
      embeddedX.push(getFieldPathBetweenFields(explore, field));
    }
    if (tag.has('y')) {
      embeddedY.push(getFieldPathBetweenFields(explore, field));
    }
  });

  // Add all x's found
  embeddedX.forEach(path => {
    spec.x.fields.push(path);
  });

  // For now, only add first y. Will handle multiple y's later
  if (embeddedY.at(0)) {
    spec.y.fields.push(embeddedY.at(0)!);
  }

  // If still no x or y, attempt to pick the best choice
  if (spec.x.fields.length === 0) {
    // Pick first string field for x. (what about dates? others? basically non numbers?)
    const stringFields = explore.allFields.filter(
      f => f.isAtomicField() && f.isString()
    );
    if (stringFields.length > 0)
      spec.x.fields.push(getFieldPathBetweenFields(explore, stringFields[0]));
  }
  if (spec.y.fields.length === 0) {
    // Pick first numeric field for y
    const numberField = explore.allFields.find(
      f => f.isAtomicField() && f.isNumber()
    );
    if (numberField)
      spec.y.fields.push(getFieldPathBetweenFields(explore, numberField));
  }

  // Create bar mark
  const barMark: Mark = {
    id: 'bar',
    type: 'bar_y',
    x: null, // inherit from x channel
    y: null, // inherit from y channel
  };
  spec.marks.push(barMark);

  // Determine scale types for channels
  // TODO: Make this derived from the fields chosen
  spec.x.type = 'nominal';
  spec.y.type = 'quantitative';

  return spec;
}
