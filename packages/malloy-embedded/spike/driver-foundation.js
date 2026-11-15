/* eslint-disable */
// SPIKE harness: not product code. See README.md.
// SPIKE: what malloy-duckdb's js/driver.js becomes on the Foundation API.
// Runs in QuickJS after malloy-runtime.js. The C++ side supplies, all sync:
//   __malloyHost.readURL(url) -> text      __malloyHost.mtime(url) -> string|null
//   __malloyHost.query(sql)   -> JSON rows (the database the extension is in)
(function () {
  'use strict';
  const host = globalThis.__malloyHost;
  const {Runtime, CacheManager, InMemoryModelCache, HostDuckDBConnection} =
    globalThis.malloy;

  const connection = new HostDuckDBConnection('duckdb', {
    query: sql => JSON.parse(host.query(sql)),
  });
  const runtime = new Runtime({
    urlReader: {
      readURL: async url => ({
        contents: host.readURL(url.toString()),
        invalidationKey: host.mtime(url.toString()),
      }),
      getInvalidationKey: async url => host.mtime(url.toString()),
    },
    connection,
    cacheManager: new CacheManager(new InMemoryModelCache()),
  });

  // The session model: each `malloy` statement extends the last.
  let session = runtime.loadModel('');

  function describe(model) {
    return model.explores.map(e => ({
      name: e.name,
      primaryKey: e.primaryKey,
      fields: e.allFields.map(f => ({
        name: f.name,
        kind: f.isExploreField()
          ? 'join'
          : f.isQueryField()
            ? 'view'
            : f.isAtomicField() && f.isCalculation()
              ? 'measure'
              : 'dimension',
        description: f.annotations.texts('"').join(' ').trim() || undefined,
      })),
    }));
  }

  globalThis.malloyDuckDB = {
    version: () => globalThis.malloy.version,
    toSQL: (modelURL, queryText) =>
      runtime.loadModel(new URL(modelURL)).loadQuery(queryText).getSQL(),
    listSources: async modelURL =>
      describe(await runtime.loadModel(new URL(modelURL)).getModel()),
    sessionAdd: async text => {
      const next = session.extendModel(text);
      await next.getModel(); // throws MalloyError, positions relative to `text`
      session = next;
      return describe(await session.getModel()).map(e => e.name);
    },
    sessionSQL: queryText => session.loadQuery(queryText).getSQL(),
  };
})();
