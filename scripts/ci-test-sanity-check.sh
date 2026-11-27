#! /bin/bash

# Checks that every spec in the tree is run by some CI job: the core job, or
# some database's `npm run dbtest`. A spec no job selects would never run.
#
# test/consumer-canary is excluded: its spec deliberately runs under its own plain
# ts-jest config (the `consumer-canary` CI job, `npm run consumer-canary`), not the main
# jest projects. See test/consumer-canary/CONTEXT.md.

MALLOY_ROOT=$(cd $(dirname $0)/..; pwd)
all_test_file=/tmp/mly_all_test.$$
ci_test_file=/tmp/mly_ci_test.$$
cd $MALLOY_ROOT
find $MALLOY_ROOT/packages $MALLOY_ROOT/test $MALLOY_ROOT/scripts \( -name node_modules -o -name dist \) -prune -o \( -name '*.spec.ts' -o -name '*.spec.tsx' \) -print | grep -v '/test/consumer-canary/' | sort > $all_test_file

status=0
env -u MALLOY_DATABASE npx jest --listTests --selectProjects core malloy-render-test malloy-render > $ci_test_file || status=1
databases=$(npx ts-node -e "console.log(Object.keys(require('./test/src/databases').databases).join(' '))")
for db in $databases; do
  MALLOY_DATABASE=$db MALLOY_DBTEST=1 npx jest --listTests --selectProjects $db >> $ci_test_file || status=1
done
if [ $status -ne 0 ]; then
  echo "!!!!!!! jest could not list the tests !!!!!!!!"
  rm -f $all_test_file $ci_test_file
  exit 1
fi

sort -u $ci_test_file -o $ci_test_file
comm -23 $all_test_file $ci_test_file > $all_test_file.missing
rm -f $all_test_file $ci_test_file
if [ -s $all_test_file.missing ]; then
  echo "!!!!!!! These specs are run by no CI job (see the Testing section of CONTEXT.md) !!!!!!!!"
  cat $all_test_file.missing
  rm -f $all_test_file.missing
  exit 1
fi
rm -f $all_test_file.missing
exit 0
