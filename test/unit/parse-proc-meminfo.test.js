/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { match } = require('../lib/custom-assertions')

const parseMemInfo = require('../../lib/parse-proc-meminfo')

// Most functionality is covered in-depth via cross-agent tests in
// test/integration/pricing/proc_meminfo.tap.js

test('Should return `null` when data is null', () => {
  const result = parseMemInfo(null)
  assert.equal(match(result, null), true)
})

test('Should return `null` when data is undefined', () => {
  const result = parseMemInfo(undefined)
  assert.equal(match(result, undefined), true)
})
