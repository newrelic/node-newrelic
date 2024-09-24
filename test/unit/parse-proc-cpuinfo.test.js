/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { match } = require('../lib/custom-assertions')

const parseCpuInfo = require('../../lib/parse-proc-cpuinfo')

// Most functionality is covered in-depth via cross-agent tests in
// test/integration/pricing/proc_cpuinfo.tap.js

test('Should return object with null processor stats when data is null', () => {
  const expectedStats = {
    logical: null,
    cores: null,
    packages: null
  }

  const result = parseCpuInfo(null)

  assert.equal(match(result, expectedStats), true)
})

test('Should return object with null processor stats when data is undefined', () => {
  const expectedStats = {
    logical: null,
    cores: null,
    packages: null
  }

  const result = parseCpuInfo(undefined)

  assert.equal(match(result, expectedStats), true)
})
