#! /bin/bash

# This tests to make sure the suite of tests run in CI contains all the
# tests in the source tree.

MALLOY_ROOT=$(cd $(dirname $0)/..; pwd)
all_test_file=/tmp/mly_all_test.$$
ci_test_file=/tmp/mly_ci_test.$$
cd $MALLOY_ROOT
find $MALLOY_ROOT/packages $MALLOY_ROOT/test -name '*.spec.ts' -or -name '*.spec.tsx' | sort > $all_test_file
npx jest --listTests | sort > $ci_test_file
diff $all_test_file $ci_test_file
status=$?
rm -rf $all_test_file $ci_test_file
if [ $status -ne 0 ]; then
  echo "!!!!!!! jest.config.ts project configurations must up dated, some tests are missing !!!!!!!!"
  exit 1;
fi
exit 0
