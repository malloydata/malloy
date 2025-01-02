#! /bin/bash

# This tests to make sure the suite of tests run in CI contains all the
# tests in the source tree.

MALLOY_ROOT=$(cd $(dirname $0)/..; pwd)
all_test_file=/tmp/mly_all_test.$$
ci_test_file=/tmp/mly_ci_test.$$
cd $MALLOY_ROOT
npx jest --listTests | sort > $all_test_file
for ci_test in jest.*.config.ts; do
  npx jest --config $ci_test --listTests >> $ci_test_file
done
sort -u $ci_test_file -o $ci_test_file
diff $all_test_file $ci_test_file
status=$?
rm -rf $all_test_file $ci_test_file
if [ $status -ne 0 ]; then
  echo "!!!!!!! jest.config.* CI configurations must up dated, some tests are missing !!!!!!!!"
  exit 1;
fi
exit 0
