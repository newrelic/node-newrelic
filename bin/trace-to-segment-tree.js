#!/usr/bin/env node
/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// The purpose of this script is to reduce a trace's JSON representation into
// a segment representation that will pass
// `./test/lib/custom-assertions/assert-segments`. To utilize this tool:
//
// 1. Add a debug point at which you would try to compare the current
//    transaction's segments.
// 2. Utilizing the debugger, inspect `transaction.trace.toJSON()`.
// 3. Copy the result.
// 4. Write the result to a JSON file, e.g. `/tmp/trace.json`.
// 5. Run this tool and provide the JSON file as the sole parameter.

process.exitCode = 1

if (process.argv.length !== 3) {
  console.error('Missing input file. Script should be run like:\n')
  console.error('  trace-to-segment-tree.js /path/to/some.json')
  process.exit()
}

let input
try {
  input = require(process.argv[2])
} catch (error) {
  console.error('Could not parse input JSON. It must be a trace array.')
  console.error(error)
  process.exit()
}

const reduced = require('../test/lib/trace-to-segment-tree.js')(input)
console.log(
  JSON.stringify(reduced, null, 2)
)
process.exitCode = 0
