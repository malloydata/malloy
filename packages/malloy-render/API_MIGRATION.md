# Malloy Render API Migration Guide

## Overview

This document describes the migration from the web component-based API to the new JavaScript API for `@malloydata/render`.

## New JavaScript API

### Basic Usage

```javascript
import {MalloyRenderer} from '@malloydata/render';

// Set up a global renderer with options
const renderer = new MalloyRenderer({
  onClick: payload => console.log('Click:', payload),
  onDrill: drillData => console.log('Drill:', drillData),
  tableConfig: {
    rowLimit: 1000,
    shouldFillWidth: true,
    enableDrill: true,
  },
});

// Create a viz instance
const viz = renderer.createViz();

// Pass in data
viz.setResult(malloyResult);

// Get metadata about the query renderers
viz.getMetadata();

// Render to a DOM element
const targetElement = document.getElementById('malloy_chart');
viz.render(targetElement);

// Update results and re-render into the same DOM node
viz.setResult(nextMalloyResult);
viz.render();

// Remove from DOM element, dispose of component
viz.remove();
```

### API Reference

#### `MalloyRenderer`

The main renderer class that manages global configuration.

```typescript
class MalloyRenderer {
  constructor(options?: MalloyRendererOptions);
  createViz(additionalOptions?: Partial<MalloyRendererOptions>): MalloyViz;
  updateOptions(newOptions: Partial<MalloyRendererOptions>): void;
  getOptions(): MalloyRendererOptions;
}
```

#### `MalloyViz`

Represents an individual visualization instance.

```typescript
class MalloyViz {
  constructor(options: MalloyRendererOptions);
  setResult(malloyResult: Malloy.Result): void;
  render(targetElement?: HTMLElement): void;
  remove(): void;
  updateOptions(newOptions: Partial<MalloyRendererOptions>): void;
  getMetadata(): RenderFieldMetadata | null;
  getHTML(): Promise<string>;
  copyToHTML(): Promise<void>;
  static addStylesheet(styles: string): void;
}
```

#### Types

```typescript
interface MalloyRendererOptions {
  onClick?: (payload: MalloyClickEventPayload) => void;
  onDrill?: (drillData: DrillData) => void;
  onError?: (error: Error) => void;
  vegaConfigOverride?: VegaConfigHandler;
  tableConfig?: Partial<TableConfig>;
  dashboardConfig?: Partial<DashboardConfig>;
  modalElement?: HTMLElement;
  scrollEl?: HTMLElement;
}
```

## Migration from Web Component API

### Before (Web Component)

```html
<malloy-render></malloy-render>

<script>
  const element = document.querySelector('malloy-render');
  element.malloyResult = result;
  element.onClick = payload => console.log(payload);
</script>
```

### After (JavaScript API)

```javascript
import {MalloyRenderer} from '@malloydata/render';

const renderer = new MalloyRenderer(globalRenderOptions);

const viz = renderer.createViz(vizRenderOptions);
viz.setResult(result);
viz.render(document.querySelector('#my-container'));
```

## CSS Changes

### Before (Shadow DOM)

CSS was injected into shadow root using special methods:

```javascript
// Old approach - no longer needed
config.addCSSToShadowRoot(css);
```

### After (Native DOM)

Components now import CSS naturally:

```javascript
// New approach
import './component.css';
```

CSS selectors that used `:host` are now scoped to the container ".malloy-render":

```css
/* Before */
:host {
  font-family: var(--malloy-render--font-family);
}

/* After - automatically scoped */
.malloy-render {
  font-family: var(--malloy-render--font-family);
}
```

The renderer will continue to expose CSS variables for customizing the theme, but optionally you can add your own CSS to target internals. The latter is not recommended as internals will change over time.

## Breaking Changes

1. **Web Component Removed**: The `<malloy-render>` web component is no longer available
2. **CSS Handling**: No ShadowRoot boundaries around CSS
3. **Import Changes**: New imports for the JavaScript API
4. **DOM Structure**: Renders directly into provided element instead of shadow root
5. **HTML Export**: New methods `getHTML()` and `copyToHTML()` for exporting visualizations

## Backward Compatibility

The old exports are still available for existing code:

```javascript
// Legacy exports still work
import {HTMLView, JSONView, getDataTree} from '@malloydata/render';
```

## Implementation Details

### Under the Hood

- Uses SolidJS components for rendering
- Uses `solid-js/web` `render()` function to mount to DOM
- CSS is injected into document head with `data-malloy-viz` attribute
- No web component infrastructure required
- Supports HTML export functionality for copying visualizations

## Migration Steps

1. **Replace web component usage** with JavaScript API
2. **Update imports** to use new API classes
3. **Update CSS handling** if you were using custom styles
4. **Test thoroughly** - behavior should be identical but integration is different
5. **Update HTML export** if you were using the old export methods
