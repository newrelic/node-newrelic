#! /bin/bash

# Copyright 2020 New Relic Corporation. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

set -x

VERSIONED_MODE="${VERSIONED_MODE:---minor}"
SAMPLES="${SAMPLES:-10}"
export NODE_OPTIONS="--max-old-space-size=4096"
SKIP_C8="${SKIP_C8:-false}"
# In CI we only want to run lcovonly
# but when running locally we want to see the beautiful
# HTML reports too
C8_REPORTER="${C8_REPORTER:-lcov}"

# OUTPUT_MODE maps to `--print` of the versioned-tests runner.
# Known values are "simple", "pretty", and "quiet".
OUTPUT_MODE="${OUTPUT_MODE:-pretty}"

# TARGET_PATTERNS may be a comma separated list of glob like patterns
# that will narrow which versioned tests are actually run. For example,
# if you only want to run the "prisma" versioned tests, then do:
#     export TARGET_PATTERNS=prisma
#     npm run versioned:major
TARGET_PATTERNS="${TARGET_PATTERNS}"
if [ ! -z "${TARGET_PATTERNS}" ]; then
  TARGET_PATTERNS="--pattern ${TARGET_PATTERNS}"
fi

MATRIX_COUNT_ONLY=${MATRIX_COUNT_ONLY:-0}
if [[ ${MATRIX_COUNT_ONLY} -ne 0 ]]; then
  MATRIX_COUNT="--matrix-count"
else
  MATRIX_COUNT=""
fi


set -f
directories=()
if [[ "$1" != '' ]];
then
  directories=(
    "test/versioned/${1}"
  )
else
  directories=(
    "test/versioned/"
    "test/versioned-external"
  )
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
echo "C8 = ${C8}"

# if $JOBS is not empty
if [ ! -z "$JOBS" ];
then
  JOBS_ARGS="--jobs $JOBS"
fi
export NR_LOADER=./esm-loader.mjs

time $C8 ./node_modules/.bin/versioned-tests \
  $VERSIONED_MODE \
  $MATRIX_COUNT \
  --print $OUTPUT_MODE \
  -i 100 \
  --all \
  --strict \
  --samples $SAMPLES \
  $JOBS_ARGS \
  ${TARGET_PATTERNS} \
  ${directories[@]}
