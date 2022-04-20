# Malloy Composer Demo

The Malloy Composer Demo is provided as a working example of an application built using Malloy. 

## Running the Composer

### Install Malloy
If you haven't already done so, you'll need to start by [Building the Malloy repo](https://github.com/looker-open-source/malloy/blob/main/developing.md). Install the dependencies in that link, then in the top-level `malloy/` directory, run:
1. `yarn install` to install dependencies
2. `yarn build` to build all the libraries Malloy needs

Make sure you have a [database connected](https://looker-open-source.github.io/malloy/documentation/connection_instructions.html), and you'll also likely want to set up the [VS Code Extension](https://github.com/looker-open-source/malloy#installing-the-extension).

### Launch the Composer

In the `malloy/demo/malloy-demo-composer` directory, run `yarn start`. 

This should open up the composer at localhost:3000 in your browser. You should see any `.malloy` models you place in a `/malloy/` directory (you'll need to create this) listed in the "Select analysis..." menu at the top left. If you don't already have Malloy models built you'd like to work with, try making a copy of one of the [samples](https://github.com/looker-open-source/malloy/tree/main/samples); these are all built on public BigQuery datasets!

_Troubleshooting note: If you have models in your `/malloy/` directory and nothing is showing up in the explorer, you may have errors in one of them. Try opening them up in VS Code with the Malloy Extension installed to find the problem._


## Development

In development, run `yarn start` to concurrently run the development web server (port `3000`) and the API server (port `4000`).

## Production

You can build a production version of the app using `yarn build`.

Running `yarn start-server` will start the server on port `4000`. Routes beginning with `/api` will use the API, `/fonts` will get static fonts, `/static` will get other static files, and all other routes will yield the `index.html` page.
