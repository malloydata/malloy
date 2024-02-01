import {Result, Field, Tag, Explore} from '@malloydata/malloy';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Spec = any;

// Take a structure of plot tags and convert it into a spec we can use
export function parsePlotTags(result: Result) {
  const {tag} = result.tagParse();
  const plot = tag.tag('plot');
  if (!plot) {
    // Throw error?
    throw new Error('No plot tag found');
  }

  const spec: Spec = {
    x: {
      fields: plot.text('x') ? [plot.text('x')] : [],
      type: plot.text('x', 'type') ?? null,
    },
    y: {
      fields: [],
      type: plot.text('y', 'type') ?? null,
    },
    color: {
      fields: [],
      type: plot.text('color', 'type') ?? null,
    },
    fx: {
      fields: [],
    },
    fy: {
      fields: [],
    },
    marks: [],
    lists: {},
  };

  const lists = plot.tag('lists')?.dict ?? {};
  for (const [id, tag] of Object.entries(lists)) {
    const currList = tag.array();
    if (currList) spec.lists[id] = currList;
  }

  parseRootMarks(spec, plot);

  // possible util: mergeAt(path, objToMerge)

  // iterate through result meta and lift out any x's
  // need to stop / reset at layers?
  walkFields(result.resultExplore, field => {
    const {tag} = field.tagParse();

    // Pull out explicit x's and y's
    parseDimension({dim: 'x', tag, spec, field});
    parseDimension({dim: 'y', tag, spec, field});
    parseDimension({dim: 'fx', tag, spec, field});

    parseMarks(field, spec);
  });

  // Update x/y based on final marks
  for (const mark of spec.marks) {
    if (mark.x && !spec.x.fields.includes(mark.x)) {
      spec.x.fields.push(mark.x);
    }
    if (mark.y && !spec.y.fields.includes(mark.y)) {
      spec.y.fields.push(mark.y);
    }
  }

  // Update types. just get first for now
  const firstXFieldPath = spec.x.fields.at(0);
  const firstXField = getField(result.resultExplore, firstXFieldPath);
  if (firstXField) spec.x.type = getScaleTypeFromField(firstXField as Field);
  const firstYFieldPath = spec.y.fields.at(0);
  const firstYField =
    firstYFieldPath && getField(result.resultExplore, firstYFieldPath);
  if (firstYField) spec.y.type = getScaleTypeFromField(firstYField as Field);
  const firstColorFieldPath = spec.color.fields.at(0);
  const firstColorField =
    firstColorFieldPath && getField(result.resultExplore, firstColorFieldPath);
  if (firstColorField)
    spec.color.type = getScaleTypeFromField(firstColorField as Field);

  return spec;
}

function getField(explore: Explore, path: string) {
  const paths = path.split('.');
  return paths.reduce<Explore | Field | undefined>((acc, curr) => {
    if (acc && acc.isExplore()) {
      return acc.getFieldByNameIfExists(curr);
    }
    return;
  }, explore);
}

function getScaleTypeFromField(f: Field) {
  if (f.isAtomicField() && f.isNumber()) return 'quantitative';
  else return 'nominal';
}

function parseDimension({
  dim,
  tag,
  spec,
  field,
}: {
  dim: 'x' | 'y' | 'fx' | 'fy';
  tag: Tag;
  spec: any;
  field: Field;
}) {
  if (tag.tag(dim)) {
    addToDim(dim, spec, field);
  }
}

function addToDim(dim: 'x' | 'y' | 'fx' | 'fy', spec: Spec, field: Field) {
  // Tracks all fields to be used. (so it blends?)
  const fields = [...spec[dim].fields, getFieldPathFromRoot(field)];

  // Today: assumes we use the first matching type. Probably need a better strategy for mixed data? Just convert mixed to nominal strings?
  const type = spec[dim].type ?? getScaleTypeFromField(field);
  spec[dim] = {
    ...spec[dim],
    fields,
    type,
  };
}

function parseRootMarks(spec: Spec, plotTag: Tag) {
  const marks = plotTag.tag('marks')?.dict ?? {};
  for (const [id, tag] of Object.entries(marks)) {
    if (tag.eq === 'barY') {
      createBarYMark(spec, tag, {id});
    }
  }
}

function parseMarks(field: Field, spec: Spec) {
  const {tag} = field.tagParse();
  if (tag.has('barY')) {
    parseBarY(field, spec);
  }
}

function parseBarY(field: Field, spec: Spec) {
  // Lift up the y field
  // Should y from marks just happen after all marks have been created, so we can do in one pass?
  // addToDim('y', spec, field);
  // Create a mark and lift up
  const markTag = field.tagParse().tag.tag('barY')!;
  createBarYMark(spec, markTag, {id: markTag.text('id'), field});
}

const getNextId = () => crypto.randomUUID();

/*
  Need to think more about how merging is supposed to happen between top level and embedded mark defs
  Also the API needs work. Kind of weird to define the marktype twice? Like
  # plot.marks.bar=barY { --some settings-- }
  view: d is {
    group_by: category
    # barY=bar
    aggregate: price
  }

  Would it make more sense to have a separate tag for referencing a mark by id? Like
  # plot.marks.bar=barY { --some settings-- }
  view: d is {
    group_by: category
    # mark=bar
    aggregate: price
  }

  What's interesting about the above is that you could create a re-usable mark layer, and then assign it with embedding. Something like
  #@bar plot.marks.bar=barY { --some settings-- }

  # @bar
  view: d is {
    group_by: category
    # mark=bar
    aggregate: price
  }

  Regardless, I suspect the following:
  - # barY should ALWAYS create a new mark
  - # barY=foo should ALWAYS create a new mark with the id foo. If a top level mark already exists with that id, it should throw
  - If you want to reference an already existing mark, you should use `mark=foo` tag

  With this, is there a way to control what the default field interpretation is? Could we not use id as eq but instead as "prop to map field to"? Then could do stuff like
  # plot
  view: d is {
    group_by: category
    aggregate:
      # barY=y { id=foo } -- y is default, doesn't need to be stated...
      price
      # mark=foo.color -- how to assign color default here??
      quantity
      -- or something simpler, like an @ identifier
      # @foo=color
      quantity
  }

  scatterplot example
  # plot.marks.pt=dot
  view: d is {
    group_by:
      # `@pt`=color
      category
      product
    aggregate:
      # `@pt`=x
      price
      # `@pt`=y
      quantity
  }

  scatterplot example
  # plot.marks.pt=dot
  view: d is {
    group_by:
      # `@pt.color`
      category
      product
    aggregate:
      # `@pt.x`
      price
      # `@pt.y`
      quantity
  }

  One thing for sure: I think it makes most sense to explicitly make id a prop, and not use it as the eq. That way it matches with the top level spec better. And can save the eq for the channel?
*/
function createBarYMark(
  spec: Spec,
  tag: Tag,
  opts: {id?: string; field?: Field} = {}
) {
  const currentContextPath = opts.field ? getFieldPathFromRoot(opts.field) : '';
  const id = opts.id ?? getNextId();
  const existingMarkIdx = spec.marks.findIndex(m => m.id === id);
  const existingMark = spec.marks[existingMarkIdx] ?? {};
  // What to do if user tries to define a mark and existing mark with different types?
  // Throw an error?
  if (existingMark.type && existingMark.type !== 'barY') {
    throw Error("Can't redefine a mark with a different type");
  }
  let y: string | null = null;
  if (tag.text('y'))
    y = getFieldPathFromRef(
      tag.text('y')!,
      opts.field?.parentExplore.isExploreField()
        ? getFieldPathFromRoot(opts.field.parentExplore)
        : ''
    );
  else if (opts.field) y = getFieldPathFromRoot(opts.field);
  else if (existingMark.y) y = existingMark.y;

  let fillColorFieldPath: string | null = null;
  // how to get relative path here??
  if (tag.text('fill')) {
    fillColorFieldPath = getFieldPathFromRef(
      tag.text('fill')!,
      currentContextPath
    );
    // util for adding / removing fields...
    if (!spec.color.fields.includes(fillColorFieldPath)) {
      spec.color.fields.push(fillColorFieldPath);
    }
  }

  const zFieldPath = tag.text('z')
    ? getFieldPathFromRef(tag.text('z')!, '')
    : null;

  const mark = {
    type: 'barY',
    y,
    yList: firstReal(tag.text('y', 'list'), existingMark.yList, null),
    x: tag.text('x') ?? existingMark.x ?? null,
    id,
    z: firstReal(zFieldPath, fillColorFieldPath, existingMark.z, null),
    fill: fillColorFieldPath,
    fillList: oneOf(tag.text('fill', 'list'), existingMark.fillList, null),
  };
  // Should y be parsed at this point?
  if (existingMarkIdx > -1) spec.marks[existingMarkIdx] = mark;
  else spec.marks.push(mark);
}

function walkFields(e: Explore, cb: (f: Field) => void, context?: any) {
  context = context ?? {path: e.fieldPath};
  e.allFields.forEach(f => {
    cb(f);
    if (f.isExplore()) {
      walkFields(f, cb, {
        ...context,
        path: f.fieldPath,
      });
    }
  });
}

function getFieldPathFromRoot(f: Field) {
  return fieldPathFromExplore(f).join('.');
}

function fieldPathFromExplore(f: Field) {
  const res = f.parentExplore.isExploreField()
    ? getFieldPathFromRoot(f.parentExplore)
    : [];
  return [...res, f.name];
}

function getFieldPathFromRef(t: string, contextPath: string) {
  const match = t.match(/^(\^*)(.*)/);
  if (!match) return t;
  const [, parentScoping, fieldName] = match;
  const ancestorCt = parentScoping.length;
  const basePath =
    ancestorCt > 0
      ? contextPath.split('.').slice(0, -ancestorCt).join('.')
      : contextPath;
  return [basePath, fieldName].filter(d => d).join('.');
}

// Might be better as a `oneOf()` method, with an optional second arg for comparison. So the other stuff would have to be in an array?
function firstReal(...things) {
  let thing;
  let i = 0;
  while (
    i < things.length &&
    (typeof thing === 'undefined' || thing === null)
  ) {
    thing = things[i];
    i++;
  }
  return thing;
}

// maybe oneOf and oneOfWith (that takes override)
function oneOf(...things) {
  return oneOfWith(things);
}
function oneOfWith(things, compOverride?) {
  const shouldPass =
    compOverride ??
    (thing => typeof thing !== 'undefined' && typeof thing !== null);
  let thing;
  let i = 0;
  while (i < things.length && !shouldPass(thing)) {
    thing = things[i];
    i++;
  }
  return thing;
}
