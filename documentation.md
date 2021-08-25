## Documentation Develoment

Documentation is a static site built by [Jekyll](https://jekyllrb.com/) with
some custom preprocessing.

Source for documentation lives in the `/docs/_src` directory. Any `.md`
files will be included in compiled documentation, `table_of_contents.json`
specifies the sidebar, and any other files will be copied as static files.

Custom preprocessing is done in `/docs/_scripts/build_docs/index.ts`.

### Installation

Jekyll is a Ruby Gem, so you will need to have Ruby 2.5.0+, RubyGems, GCC,
Make, and Bundler installed. See [here](https://jekyllrb.com/docs/installation/)
for more info on Jekyll's requirements.

To install Bundler, run
```
gem install bundler
```

Once all that is installed, you can install Jekyll and its Ruby dependencies:

```
bundle install
```

### Compile

To compile the documentation, run `yarn docs-build`. Your system must be
authenticated to a BigQuery instance with access to all the public tables referenced in the
`/samples` models.

### Develop

For developing the documentation, run `yarn docs-serve` build the docs, watch for
file changes in any of the docs, static files, or sample models, and serve the result
at [http://127.0.0.1:4000](http://127.0.0.1:4000). Jekyll hot-reloading is
enabled, so pages should automatically refresh when changes are made. When initial
compilation is complete, a browser should open to the home page.

Code blocks in the documentation may begin with a command string to indicate
whether the code should be run, and how the query should be compiled or the results
formatted. This command string is JSON-formatted and must appear on the first
line in a comment with an `!`, like: `--! { "isRunnable": true }`. For example,

~~~
```malloy
--! {"isRunnable": true, "source": "faa/flights.malloy", "size": "large"}
explore flights | sessionize
```
~~~

Currently, options include `isRunnable` (which must be `true` for the snippet
to run), `project` (which refers to a directory in `/samples`), `model` (
which refers to a file (not including the `.malloy` extension inside that
directory), and `size` (which adjusts the maximum scroll size of the results).

### Style

The following list describes style conventions used in the docs.

* Use headers (`# Foo`, `## Bar`, etc.) to organize document structure, not for
  emphasis. If you want to show emphasis, do it with `**bold**` or `_italics_`.
* Code spans (`` `explore flights` ``) are by default _Malloy_ syntax-highlighted. If
  you are writing a code span with code in any other language, use an HTML code tag,
  e.g. `<code>SELECT *</code>`

### Deploy

To deploy the docs, use the following steps:

1. Merge any docs changes into `main`
2. `git pull main`
2. `git checkout docs-release-static`
3. `git merge main`
4. `yarn docs-build`
5. `git add docs`
6. `git commit`
7. `git push`
