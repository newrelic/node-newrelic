#! /bin/bash

# Copyright 2020 New Relic Corporation. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

set -x

VERSIONED_MODE="${VERSIONED_MODE:---major}"
if [[ $TRAVIS_BRANCH == `git describe --tags --always HEAD` ]]; then
  VERSIONED_MODE=--minor
fi

set -f
directories=()
if [[ "$1" != '' ]]; then
  directories=(
    "test/versioned/${1}"
    "node_modules/@newrelic/${1}/tests/versioned"
  )
fi

export AGENT_PATH=`pwd`

time ./node_modules/.bin/versioned-tests $VERSIONED_MODE -i 2 ${directories[@]}
