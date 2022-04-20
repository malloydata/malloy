# Malloy Composer Demo

The Malloy Composer Demo is intended to demonstrate how a visual query composer can be built on top of Malloy.

## Development

In development, run `yarn start` to concurrently run the development web server (port `3000`) and the API server (port `4000`).

## Production

You can build a production version of the app using `yarn build`.

Running `yarn start-server` will start the server on port `4000`. Routes beginning with `/api` will use the API, `/fonts` will get static fonts, `/static` will get other static files, and all other routes will yield the `index.html` page.
