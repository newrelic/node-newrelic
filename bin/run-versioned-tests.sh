#! /bin/bash

# Copyright 2020 New Relic Corporation. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

set -x
echo "mode $EXTERNAL_MODE"

VERSIONED_MODE="${VERSIONED_MODE:---minor}"
SAMPLES="${SAMPLES:-10}"
export NODE_OPTIONS="--max-old-space-size=4096"
SKIP_C8="${SKIP_C8:-false}"
# In CI we only want to run lcovonly
# but when running locally we want to see the beautiful
# HTML reports too
C8_REPORTER="${C8_REPORTER:-lcov}"
# Options: none, only, include
# None skips running external
# Only runs only external
# Include runs external with "internal"
EXTERNAL_MODE="${EXTERNAL_MODE:-include}"

# OUTPUT_MODE maps to `--print` of the versioned-tests runner.
# Known values are "simple", "pretty", and "quiet".
OUTPUT_MODE="${OUTPUT_MODE:-pretty}"

# Determine context manager for sanity sake
if [[ $NEW_RELIC_FEATURE_FLAG_LEGACY_CONTEXT_MANAGER == 1 ]];
then
  CTX_MGR="Legacy"
else
  CTX_MGR="AsyncLocalStorage"
fi

set -f
directories=()
if [[ "$1" != '' ]];
then
  if [[ "$EXTERNAL_MODE" = "include" ]];
  then
    directories=(
      "test/versioned/${1}"
      "test/versioned-external/TEMP_TESTS/${1}"
      "test/versioned-external/TEMP_TESTS/${1}/tests/versioned"
    )
  elif [[ "$EXTERNAL_MODE" = "none" ]];
  then
    directories=(
      "test/versioned/${1}"
    )
  elif [[ "$EXTERNAL_MODE" = "only" ]];
  then
    directories=(
      "test/versioned-external/TEMP_TESTS/${1}"
      "test/versioned-external/TEMP_TESTS/${1}/tests/versioned"
    )
  fi
else
  if [[ "$EXTERNAL_MODE" = "include" ]];
  then
    directories=(
      "test/versioned/"
      "test/versioned-external"
    )
  elif [[ "$EXTERNAL_MODE" = "none" ]];
  then
    directories=(
      "test/versioned/"
    )
  elif [[ "$EXTERNAL_MODE" = "only" ]];
  then
    directories=(
      "test/versioned-external"
    )
  fi
fi

# No coverage as env var is true
# set C8 to ""
if [[ "${SKIP_C8}" = "true" ]];
then
  C8=""
else
  # lcovonly only generates lcov report which will cut down on amount of time generating reports
  C8="c8 -o ./coverage/versioned --merge-async -r $C8_REPORTER"
fi

export AGENT_PATH=`pwd`

# Runner will default to CPU count if not specified.
echo "JOBS = ${JOBS}"
echo "CONTEXT MANAGER = ${CTX_MGR}"
echo "C8 = ${C8}"
echo "EXTERNAL_MODE = ${EXTERNAL_MODE}"

# if $JOBS is not empty
if [ ! -z "$JOBS" ];
then
  JOBS_ARGS="--jobs $JOBS"
fi
export NR_LOADER=./esm-loader.mjs

time $C8 ./node_modules/.bin/versioned-tests $VERSIONED_MODE --print $OUTPUT_MODE -i 2 --all --strict --samples $SAMPLES $JOBS_ARGS ${directories[@]}
