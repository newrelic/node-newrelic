#!/bin/sh
#
# Checks all staged files for
# package.json. If it changes
# it will re-run `oss third-party manifest`
# and `oss third-party notices` to keep
# these files up to date as deps get updated

STAGED_FILES=$(git diff-index --cached --name-only HEAD)

for FILE in $STAGED_FILES
do
  if [ $FILE == "package.json" ]; then
    RUN_THIRD_PARTY=1
    break
  fi
done

if [ -n "$RUN_THIRD_PARTY" ]; then
  echo "package.json changed, running oss manifest and notices"
  npm run third-party-updates
fi
