#! /bin/bash

# This tests to make sure the suite of tests run in CI contains all the
# tests in the source tree.
#
# node_modules is pruned: a dependency that ships its own *.spec.ts (parse5's
# `entities` does) would otherwise be reported as a test CI forgot to run, which
# reads as a jest.config.ts problem and is not one.
#
# test/consumer-canary is excluded: its spec deliberately runs under its own plain
# ts-jest config (the `consumer-canary` CI job, `npm run consumer-canary`), not the main
# jest projects, so it never appears in `jest --listTests`. See
# test/consumer-canary/CONTEXT.md.

MALLOY_ROOT=$(cd $(dirname $0)/..; pwd)
all_test_file=/tmp/mly_all_test.$$
ci_test_file=/tmp/mly_ci_test.$$
cd $MALLOY_ROOT
find $MALLOY_ROOT/packages $MALLOY_ROOT/test $MALLOY_ROOT/scripts \
  -name node_modules -prune -o \
  \( -name '*.spec.ts' -o -name '*.spec.tsx' \) -print \
  | grep -v '/test/consumer-canary/' | sort > $all_test_file
npx jest --listTests | sort > $ci_test_file
diff $all_test_file $ci_test_file
status=$?
rm -rf $all_test_file $ci_test_file
if [ $status -ne 0 ]; then
  echo "!!!!!!! jest.config.ts project configurations must up dated, some tests are missing !!!!!!!!"
  exit 1;
fi
exit 0
