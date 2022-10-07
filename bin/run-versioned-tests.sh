#! /bin/bash

# Copyright 2020 New Relic Corporation. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

set -x

VERSIONED_MODE="${VERSIONED_MODE:---minor}"
SAMPLES="${SAMPLES:-10}"
set -f
directories=()
if [[ "$1" != '' ]];
then
  directories=(
    "test/versioned/${1}"
    "test/versioned-external/TEMP_TESTS/${1}"
    "test/versioned-external/TEMP_TESTS/${1}/tests/versioned"
  )
else
  directories=(
    "test/versioned/"
    "test/versioned-external"
  )
fi

# C8 runs out of heap when running against
# patch/minor flag.  We will just skip it
# and figure out another way to get coverage
# when running on main branch. 
if [[ $VERSIONED_MODE == '--major' ]];
then
  C8="c8 -o ./coverage/verisoned"
else 
  C8=""
fi

export AGENT_PATH=`pwd`

# Runner will default to CPU count if not specified.
echo "JOBS = ${JOBS}"
echo "NPM7 = ${NPM7}"

# if $JOBS is not empy
if [ ! -z "$JOBS" ];
then
  JOBS_ARGS="--jobs $JOBS"
fi

if [[ "${NPM7}" = 1 ]];
then
  time $C8 ./node_modules/.bin/versioned-tests $VERSIONED_MODE -i 2 --all --strict --samples $SAMPLES $JOBS_ARGS ${directories[@]}
else
  time $C8 ./node_modules/.bin/versioned-tests $VERSIONED_MODE -i 2 --strict --samples $SAMPLES $JOBS_ARGS ${directories[@]}
fi
