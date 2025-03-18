# Adding a new database type to Malloy

There are two components needed to integrate a new database into Malloy, a `Dialect` and a `Connection`. For historical reasons, each `Connection` is in its own sub package (i.e `malloydata:malloy/malloy-db-postgres`), and this document does not describe how to create a new `Connection`

# Adding a new Dialect

We've not made this a formal process yet, this is the dump of the rough steps along the way. As we land some more external dialects, there will be more precision here. We are happy to help with this process, get in touch with us on [Slack](https://malloy-community.slack.com/).

## Implement a dialect object as an experimental dialect

Using an existing dialect as a guide, create a new subdirectory here for your new dialect. Usually the easiest way to do this is make a copy of a dialect which is close to your target dialect. There is no documentation on this beyond the code.

Users of this dialect will need the code `## experimental.YOUR_DIALECT` in their model files.

### Fill out the "Dialect" implementation.
  * There are many boolean flags, make sure they match your dialect
  * In particular, make sure your dialect is `experimental = true`. Dialects which are
    experimental are not required to pass all tests.
  * Implement the various SQL writing abstract methods needed

### Prepare for testing

* Figure out how to provide a test instance for the CI builds
    * A docker script for setting up / tearing down an instance
    * OR set of credentials which the CI can use to access an outside instance
* Figure out how to populate the test instance with the test data
    * Ideally implement a loader script which can read parquet files
* Add your dialect to the test runner configurations in `test/src/runtimes.ts`
* Implement any dialect specific tests
    * These would go in `test/src/databases/YOUR_DIALECT`
    * There would also need to a a `jest.YOUR_DIALECT.config` file
    * Add a CI build which runs the jest config

Once there is a PR which matches this, we can accept A PR to the main Malloy tree while the dialect continues to mature.

At this point, the NPM package will support Malloy code which enables that experimental dialect,
to whatever extent the experimental dialect is functional. Additionally since this dialect is in
CI, any changes to the Dialect interface or the internals of Malloy which require changes to dialect implementations will also be applied to the experimental dialect as part of our pull request review process, the dialect will continue to work.

## Moving from experimental to fully supported

In order for a dialect to be fully supported, it must pass the larger suite of tests that all supported dialects are required to pass. This is a process which isn't well defined and will involve some
back and forth with the Malloy team, but the Malloy team is eager to help anyone who wants to
get over this hurdle.

Once a dialect is ready for review, the experimental flag will be removed from the dialect
and the normal CI build will run all tests against this new dialect instead of the
restricted subset.