# Malloy Composer Demo

The Malloy Composer Demo is provided as a working example of an application built on top of Malloy. If you have any questions about getting this running, please reach out to us for help! If you find bugs or have feature requests, you can submit them as issues in this repo. 

## Running the Composer

### Install Malloy
If you haven't already done so, you'll need to start by [Building the Malloy repo](https://github.com/looker-open-source/malloy/blob/main/developing.md). Install the dependencies in that link, then in the top-level `malloy/` directory, run:
1. `yarn install` to install dependencies
2. `yarn build` to build all the libraries Malloy needs

Make sure you have a [database connected](https://looker-open-source.github.io/malloy/documentation/connection_instructions.html), and you'll also likely want to set up the [VS Code Extension](https://github.com/looker-open-source/malloy#installing-the-extension) to view and edit Malloy files.

### Launch the Composer

In the `malloy/demo/malloy-demo-composer` directory, run:
1. `yarn build` (you need to do this in addition to the above build in the top-level directory)
2. `yarn start-server`

The app will run at localhost:4000. You should see any sources defined in `.malloy` files you place in a `/malloy/` directory (you'll need to create this) listed in the "Select analysis..." menu at the top left. If you don't already have Malloy models built you'd like to work with, try making a copy of one of the [samples](https://github.com/looker-open-source/malloy/tree/main/samples); these are all built on public BigQuery datasets!

Troubleshooting notes: 
- If you have models in your `/malloy/` directory and nothing is showing up in the explorer, you may have errors in one of them. Try opening them up in VS Code with the Malloy Extension installed to find the problem.
- You'll need to define a [source](https://looker-open-source.github.io/malloy/documentation/language/source.html) for it to be explorable; top-level named queries that are not inside a source are not explorable.

### Set up Query Saving
The composer can write saved queries back to `.a.malloy` files in the `/malloy`/ directory.
1. Create a new file with the suffix `.a.malloy` (e.g. `flights.a.malloy`). You'll need separate ones for each source you want to make explorable.
2. [Import](https://looker-open-source.github.io/malloy/documentation/language/imports.html) the base file in this `.a.malloy` file, then create a refinement of a source named in the base file. For example, if your base file looks like:

```malloy
source: flights_base is table('malloy-data.faa.flights'){}
```
Your `.a.malloy` file might look like this:
```
import "file:///Users/anikaks/malloy/flights.malloy"

source: flights is flights_base {}
```
You should now see the name of your new source appear in the top left menu, and when you click the start icon in the top menu you should be able to save named queries and see them appear inside the new source. _Note: Only the last source in a `.a.malloy` file will appear in the menu._

The composer is a two-way tool; saved queries are saved into this source by the app, but you can also add/edit named queries, add fields, joins, etc. 

## Development

In development, run `yarn start` to concurrently run the development web server (port `3000`) and the API server (port `4000`).

## Production

You can build a production version of the app using `yarn build`.

Running `yarn start-server` will start the server on port `4000`. Routes beginning with `/api` will use the API, `/fonts` will get static fonts, `/static` will get other static files, and all other routes will yield the `index.html` page.
