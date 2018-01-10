#! /bin/bash

VERSIONED_MODE=--major
if [[ $TRAVIS_BRANCH == `git describe --tags --always HEAD` ]]; then
  VERSIONED_MODE=--minor
fi
# if [[ $TRAVIS_BRANCH == "master" ]]; then
#   VERSIONED_MODE=--minor
# fi

export NEW_RELIC_HOME=`pwd`/test/versioned
time ./node_modules/.bin/versioned-tests $VERSIONED_MODE -i 2 'test/versioned/**/*.tap.js'
