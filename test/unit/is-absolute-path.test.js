/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const isAbsolutePath = require('../../lib/util/is-absolute-path')

tap.test('verifies paths correctly', async (t) => {
  const tests = [
    ['./foo/bar.js', true],
    ['/foo/bar.cjs', true],
    ['/foo.mjs', true],
    ['/foo.smj', false],
    ['foo', false],
    ['foo.js', false]
  ]

  for (const [input, expected] of tests) {
    t.equal(isAbsolutePath(input), expected)
  }
})
