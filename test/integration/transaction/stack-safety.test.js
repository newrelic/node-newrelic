/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { spawn } = require('child_process')

// node --v8-options | grep -B0 -A1 stack-size
// --stack-size (default size of stack region v8 is allowed to use (in kBytes))
// type: int  default: 984
test('should not exceed stack size for extremely wide segment trees', function (t, end) {
  const nodeExec = process.argv[0]

  const args = [
    '--stack-size=328', // cut default stack size by 1/3 for faster test
    'wide-segment-tree' // test file
  ]

  const options = {
    stdio: 'inherit',
    cwd: __dirname // use current directory for file lookup
  }

  const child = spawn(nodeExec, args, options)

  child.on('exit', (code) => {
    assert.equal(code, 0, 'Should have successful exit. Check output')
    end()
  })
})
