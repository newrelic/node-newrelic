#! /bin/bash

# Copyright 2020 New Relic Corporation. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

set -x

VERSIONED_MODE="${VERSIONED_MODE:---major}"
if [[ $TRAVIS_BRANCH == `git describe --tags --always HEAD` ]]; then
  VERSIONED_MODE=--minor
fi
# if [[ $TRAVIS_BRANCH == "master" ]]; then
#   VERSIONED_MODE=--minor
# fi

set -f
directories=()
if [[ "$1" != '' ]]; then
  directories=(
    "test/versioned/${1}"
    "node_modules/@newrelic/${1}/tests/versioned"
  )
fi

export AGENT_PATH=`pwd`

# Don't run the aws-sdk tests if we don't have the keys set
if [[ -z "$AWS_ACCESS_KEY_ID" ]]; then
  time ./node_modules/.bin/versioned-tests $VERSIONED_MODE -i 2 -s aws-sdk ${directories[@]}
else
  time ./node_modules/.bin/versioned-tests $VERSIONED_MODE -i 2 ${directories[@]}
fi
