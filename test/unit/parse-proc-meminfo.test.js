/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const parseMemInfo = require('../../lib/parse-proc-meminfo')

// Most functionality is covered in-depth via cross-agent tests in
// test/integration/utilization/proc-meminfo.test.js

test('Should return `null` when data is null', () => {
  const result = parseMemInfo(null)
  assert.equal(result, null)
})

test('Should return `null` when data is undefined', () => {
  const result = parseMemInfo(undefined)
  assert.equal(result, undefined)
})
