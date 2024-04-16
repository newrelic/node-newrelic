#! /bin/bash

set -x
VERSIONED_MODE="${VERSIONED_MODE:---minor}"
SAMPLES="${SAMPLES:-15}"
C8_REPORTER="${C8_REPORTER:-lcov}"

C8="c8 -o ./coverage/versioned --merge-async -r $C8_REPORTER"

# OUTPUT_MODE maps to `--print` of the versioned-tests runner.
# Known values are "simple", "pretty", and "quiet".
OUTPUT_MODE="${OUTPUT_MODE:-pretty}"

$C8 ./node_modules/.bin/versioned-tests $VERSIONED_MODE --print $OUTPUT_MODE --samples $SAMPLES --all -i 2 'tests/versioned/*.tap.js'
