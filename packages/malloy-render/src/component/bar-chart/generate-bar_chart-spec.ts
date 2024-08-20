import {Explore, Tag} from '@malloydata/malloy';
import {Mark, PlotSpec, createEmptySpec} from '../plot/plot-spec';
import {
  getFieldFromRelativePath,
  getFieldPathBetweenFields,
  walkFields,
} from '../plot/util';

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

  // For now: support only 1 x, 1 series
  let x: string | undefined;
  const setDeclaredX = (s: string) => {
    if (typeof x !== 'undefined')
      throw new Error('Only 1 x should be declared');
    x = s;
  };
  const setX = (s: string) => (x = s);
  let series: string | undefined;
  const setDeclaredSeries = (s: string) => {
    if (typeof series !== 'undefined')
      throw new Error('Only 1 series should be declared');
    series = s;
  };
  const setSeries = (s: string) => (series = s);

  // Parse top level tags
  if (chart.text('x')) {
    setDeclaredX(chart.text('x')!);
    // spec.x.fields.push(chart.text('x')!);
  }
  if (chart.text('y')) {
    spec.y.fields.push(chart.text('y')!);
  }
  if (chart.text('series')) {
    setDeclaredSeries(chart.text('series')!);
  }

  // Parse embedded tags
  const embeddedX: string[] = [];
  const embeddedY: string[] = [];
  const embeddedSeries: string[] = [];
  walkFields(explore, field => {
    const {tag} = field.tagParse();
    if (tag.has('x')) {
      setDeclaredX(getFieldPathBetweenFields(explore, field));
      embeddedX.push(getFieldPathBetweenFields(explore, field));
    }
    if (tag.has('y')) {
      embeddedY.push(getFieldPathBetweenFields(explore, field));
    }
    if (tag.has('series')) {
      setDeclaredSeries(getFieldPathBetweenFields(explore, field));
      embeddedSeries.push(getFieldPathBetweenFields(explore, field));
    }
  });

  // series = chart.text('series') ?? embeddedSeries.at(0);

  // Add all x's found
  // TODO: throw error if multiple x's found?
  // embeddedX.forEach(path => {
  //   spec.x.fields.push(path);
  // });

  // For now, only add first y. Will handle multiple y's later
  if (embeddedY.at(0)) {
    spec.y.fields.push(embeddedY.at(0)!);
  }

  //
  // if (embeddedSeries.length > 1)
  //   throw new Error('Only should have 1 embedded series tag');

  const dimensions = explore.allFields.filter(
    f => f.isAtomicField() && f.sourceWasDimension()
  );

  // AUTO FALLBACKS
  // If still no x or y, attempt to pick the best choice
  if (!x) {
    // Pick first dimension field
    if (dimensions.length > 0) {
      setX(getFieldPathBetweenFields(explore, dimensions[0]));
      // spec.x.fields.push(getFieldPathBetweenFields(explore, dimensions[0]));
    }
  }
  if (spec.y.fields.length === 0) {
    // Pick first numeric measure field
    const numberField = explore.allFields.find(
      // f => f.isAtomicField() && f.isNumber()
      f => f.isAtomicField() && f.sourceWasMeasureLike() && f.isNumber()
    );
    if (numberField)
      spec.y.fields.push(getFieldPathBetweenFields(explore, numberField));
  }
  // If no series defined and multiple dimensions, use leftover dimension
  if (!series && dimensions.length > 1) {
    const dimension = dimensions.find(d => {
      const path = getFieldPathBetweenFields(explore, d);
      return x !== path;
    });
    if (dimension) {
      setSeries(getFieldPathBetweenFields(explore, dimension));
    }
  }

  // Now flip stuff as needed
  const isSeries = !!series;
  const isStack = chart.has('stack');
  const isGroup = !isStack;

  if (isSeries && isGroup) {
    spec.x.fields.push(series!);
    spec.fx.fields.push(x!);
    spec.color.fields.push(series!);
  } else if (isSeries) {
    // TODO stack logic with color channel...
  } else {
    spec.x.fields.push(x!);
  }

  // Create bar mark
  const barMark: Mark = {
    id: 'bar',
    type: 'bar_y',
    x: null, // inherit from x channel
    y: null, // inherit from y channel
    fill: isSeries ? spec.color.fields.at(0)! : null,
  };
  spec.marks.push(barMark);

  // Determine scale types for channels
  // TODO: Make this derived from the fields chosen
  const xField = getFieldFromRelativePath(explore, spec.x.fields.at(0)!);

  spec.x.type = 'nominal';
  spec.fx.type = 'nominal';
  spec.y.type = 'quantitative';

  console.log({spec, xField});

  return spec;
}
