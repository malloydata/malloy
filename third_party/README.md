# third_party vendored sources in Malloy

## TL;DR: don't copy sources into this repo

All sources in this repo should be authored from scratch by the committer.
Don't copy sources you've found in any other location.

## What if I have a good reason?

We do "vendor in" some sources, in cases where we do not want our users to have a transitive dependency.

Follow these guidelines for adding sources under `third_party`:

1. Only vendor sources with compatible licenses. Apache 2.0 and MIT are good. Any other licenses, check with your team lead so we can verify our ability to comply with the license.
2. Preserve the license for code. The best thing to do is copy the entire LICENSE file along with the sources.
3. Indicate where the sources came from. Our convention is to create a directory based on the URL where the sources were fetched. Add version number or if missing, the retrieval date, as a comment in the build file just above the license() call. Example: https://github.com/angular/angular/blob/master/third_party/fonts.google.com/open-sans/BUILD.bazel
4. Avoid changing the files you fetched. If you make any changes to the sources, first commit the original, then in a separate commit, make your edits. include another metadata file listing your changes, like https://github.com/bazelbuild/rules_nodejs/blob/master/third_party/github.com/source-map-support/LOCAL_MODS.md
5. Any bundle or distribution which includes this code needs to propagate the LICENSE file or content.
