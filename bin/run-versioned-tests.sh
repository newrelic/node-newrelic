#! /bin/bash

# Copyright 2020 New Relic Corporation. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

set -x

VERSIONED_MODE="${VERSIONED_MODE:---minor}"
SAMPLES="${SAMPLES:-10}"
set -f
directories=()
if [[ "$1" != '' ]]; then
  directories=(
    "test/versioned/${1}"
    "node_modules/@newrelic/${1}/tests/versioned"
  )
fi

export AGENT_PATH=`pwd`

echo "${NPM7}"

if [[ "${NPM7}" = 1 ]];
then
  time ./node_modules/.bin/versioned-tests $VERSIONED_MODE -i 2 --all --samples $SAMPLES ${directories[@]}
else
  time ./node_modules/.bin/versioned-tests $VERSIONED_MODE -i 2 --samples $SAMPLES ${directories[@]}
fi
