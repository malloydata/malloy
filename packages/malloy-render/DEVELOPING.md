# Developing the Malloy Renderer

The Malloy Renderer is developed in the `src` folder of this repository. The following sections provide guidance on how to develop, view, and debug local changes.

## New vs. Legacy renderer code

The legacy renderer is deprecated but is still available and in use for features not yet implemented in the new renderer. This legacy code lives in the `src/html` directory.

## Viewing the renderer locally

Storybook is used to view the renderer locally. To launch the storybook:

```bash
$ npm run storybook
```

Then navigate to the URL provided. In this storybook, you can navigate between different stories that render Malloy queries from the Malloy source code.

### Tips

This storybook does not hot reload, so you need to reload the page when:

- you make changes to malloy-render source code
- you add a new story

If you make changes to the malloy core package, you need to relaunch the storybook.

It is fairly common for Malloy compilation to randomly fail when opening the storybook. A simple reload of the page fixes the problem.

## Adding new stories for viewing the renderer

Stories are generated using `*.stories.malloy` files in src/stories. By default, the filename is used to produce a component name in the storybook. This can be customized using a model tag:

```malloy
// in charts.stories.malloy

##(story) component='My Charts'

source: ...
```

Stories are generated for any view annotated as `#(story)`. By default, the view name is used to produce the story name. This can be customized on the tag like so:

```malloy
// in charts.stories.malloy

source: ... {

    // Title will automatically be "My Story"
    #(story)
    view: my_story is { ... }

    // Title will be "Custom Title"
    #(story) story='Custom Title'
    view: another_story is { ... }
}
```

### Adding new data sources for stories

Data sources have to be registered in advance when creating stories. To add new data sources:

1. Add the new data file to `src/stories/static/data`
2. Register the new source by updating `.storybook/registered_data.json` with the new file name and extension.
3. Import the data in your `stories.malloy` files in `src/stories` like so:

```malloy
source: foo is duckdb.table("static/data/my_file.csv");
```

## Adding new renderers

Renderers are applied based on tags parsed on an Explore or Field. This is done in the file `src/component/apply-renderer.tsx`. To add a new renderer in this file:

1. Update the `shouldRenderAs` function that looks at the field tags and returns an enum for your renderer type
2. Update the switch statement in the `applyRenderer` function to add a case for your new renderer. Your case statement should update the `renderValue` variable using your renderer.

## Adding component CSS

The renderer is shipped as webcomponent, and any stylesheets should be appended to the ShadowDOM root instead of to the document. A utility is provided for doing this like so:

```typescript
// in file my-component.ts

// import your stylesheet as a string
import myCss from "./style.css?raw";

export function MyComponent() {
  // Add your imported CSS to the ShadowRoot
  const config = useConfig();
  config.addCSSToShadowRoot(myCSS);

  // Use your classes in your markup
  return <div class="my-component-class">hello world</div>
}
```

There are certain cases where you may need to append CSS to the document; for example, when rendering a tooltip or modal that is attached to the DOM outside of the web component. You can add this document CSS like so:

```typescript
// in file my-component.ts

// import your stylesheet as a string
import myCss from "./style.css?raw";

export function MyComponent() {
  // Add your imported CSS to the document
  const config = useConfig();
  config.addCSSToDocument(myCSS);

  // Use your classes in your markup
  return <div class="my-component-class">hello world</div>
}
```

## Renderer Metadata

Some of the renderers, especially charts, benefit from having metadata about the data table being rendered. This can include attributes like the min and max values in a numeric column, the number of rows in a nested table, etc. This metadata is derived in `src/component/render-result-metadata.ts`. The `getResultMetadata` function is used to create the `RenderResultMetadata` object. This object is shared throughout our SolidJS component tree using the Context api. To access the metadata, use the `useResultContext()` method in a component.

## Adding new charts

Charts are typically rendered using a Vega spec via the generic `Chart` component in `src/component/chart/chart.tsx`. We precompile Vega runtimes for each chart column in a query. This is done in the render result metadata creation. In the function `populateExploreMeta`, you can see examples of checking for chart tags and if finding them, creating the Vega spec and runtime for the charts in that column. Your Vega chart code should return a `VegaChartProps` object. See the examples in `populateExploreMeta` for the bar and line charts.

### Tips

- The `src/component/chart-layout-settings.ts` file is a useful file that uses metadata about a chart Explore to derive important chart attributes like padding, axes sizes, and total chart sizes that need to be encoded into a chart Vega spec.
- Vega does not provide typings for sub compenents of the Vega spec, so we currently have to resort to using a vega spec type of `any`, exported as the type `VegaSpec`.
- The bar chart and line chart specs are good examples to look at for how to create chart code. They show among other things:
  - Deriving chart configurations from chart tags and nested tags
  - Getting chart layout settings and using them
  - Defining chart interactions
  - Mapping source Result data to chart-ready data
  - Implementing tooltip behaviors

## Chart interactions

In the renderer, chart interactions are shared across charts using the same dimensions or measures. This sharing of interactions is made possible through a proxy store called the ResultStore and found in `src/component/result-store/result-store.ts`. The interactions are shared in a data structure called a Brush. A Brush represents a currently highlighted value for a specific dimension or measure.

When `chart.tsx` renders a Vega chart, it checks to see if the chart runtime has a signal defined for `brushIn`. If it does, it passes an array of the brushes relevant to that chart via the `brushIn` signal. The chart can then use that `brushIn` data to determine how to render brushes. For example, for a measure brush the chart may show a reference line.

It is highly recommened to only render brushes based on data coming in from `brushIn`, as opposed to relying on internal state of the chart. That way, charts are always synced properly via the shared external store like so:

```
                                        ----> ChartA (consumes brushes and renders them)
                                        |
ResultStore --exports shared brush data--
                                        |
                                        ----> ChartB (consumes brushes and renders them)
```

Charts may also export brushes to the ResultStore, based on user interactions within the chart. This is done via the `brushOut` signal, which `chart.tsx` will read from if it exists and use it to update the ResultStore.

This is similar to the ["Controlled Component" concept in React](https://react.dev/learn/sharing-state-between-components#controlled-and-uncontrolled-components).

For examples of how to use brushIn data and export brushOut data, see the bar chart and line chart spec generation code.

## Debugging tips

In the Storybook, hovering any of the new charts will show a debug icon in the top right. Clicking the debug icon will open that chart with a text editor of the spec and a signal and data inspector. This UI can be used to see what is happening under the hood with the Vega chart, and allow you to experiment with changing the spec.

You can also use the signal logger utility to log signal changes. This can be done in `chart.tsx` or `vega-chart.tsx` like so:

```typescript
import {signalLogger} from './vega-utils';

// Somewhere in component code where View is accessible, create logger and log some signals
const logger = signalLogger(view, optionalId); // Optional string id which will be logged as well

logger('signalA', 'signalB'); // Logs any value changes to signalA or signalB
```

## Generating builds

To generate local builds of the renderer, you can run

```
$ npm run build
```

This is useful when developing with the Malloy VSCode Extension repo, where you can use `npm run malloy-link` to reference your local build of the renderer.
