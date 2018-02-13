#! /bin/bash

VERSIONED_MODE="${VERSIONED_MODE:---major}"
if [[ $TRAVIS_BRANCH == `git describe --tags --always HEAD` ]]; then
  VERSIONED_MODE=--minor
fi
# if [[ $TRAVIS_BRANCH == "master" ]]; then
#   VERSIONED_MODE=--minor
# fi

set -f
DIRECTORY="test/versioned/**/*.tap.js"
if [[ "$1" != '' ]]; then
  DIRECTORY="test/versioned/${1}/*.tap.js"
fi

export NEW_RELIC_HOME=`pwd`/test/versioned
time ./node_modules/.bin/versioned-tests $VERSIONED_MODE -i 2 $DIRECTORY
