# Malloy Renderer

The Malloy Renderer is a web component for rendering Malloy query results. It is included by default in the Malloy VSCode extension, but can also be embedded by developers into their own applications that use Malloy query results. To learn more about how to use the renderer in a Malloy model, see [the Renderer docs](https://docs.malloydata.dev/documentation/visualizations/overview).

## Using the Renderer in Web Apps

1. Install the renderer package

```bash
$ npm i @malloydata/render
```

2. Import the web component somewhere in your project. This will automatically register the `<malloy-render>` web component on your document.

```javascript
import '@malloydata/render/webcomponent';
```

3. Use the web component in your app by creating a `<malloy-render>` node and passing it Malloy query results:

```javascript
const malloyRenderElement = document.createElement('malloy-render');
// Pass a Malloy Result object to the renderer
malloyRenderElement.result = myMalloyResult;

/*
Alternatively, you can pass Malloy QueryResult and ModelDef objects to the renderer,
which will then construct the Result object. This is useful when you are receiving serialiazed Malloy results via an API.
*/
malloyRenderElement.queryResult = myQueryResult;
malloyRenderElement.modelDef = myModelDef;
```

### Explicitly registering the web component

In some situations, such as using Malloy Render with a mock DOM like JSDOM, you may want to explicitly register the web component on a document. This can be done using the `@malloydata/render/webcomponent/register` import like so:

```javascript
import registerMalloyRender from '@malloydata/malloy-render/webcomponent/register';

const {window} = new JSDOM(`...`);

registerMalloyRender({
  customElements: window.customElements,
  HTMLElement: window.HTMLElement,
});
```

# Developing

See [DEVELOPING.readme](./DEVELOPING.md)
