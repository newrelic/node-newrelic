/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const isAbsolutePath = require('../../../lib/util/is-absolute-path')

test('verifies paths correctly', async () => {
  const tests = [
    ['./foo/bar.js', true],
    ['/foo/bar.cjs', true],
    ['/foo.mjs', true],
    ['/foo.smj', false],
    ['foo', false],
    ['foo.js', false]
  ]

  for (const [input, expected] of tests) {
    assert.equal(isAbsolutePath(input), expected)
  }
})
