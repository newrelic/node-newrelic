/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')

const parseCpuInfo = require('../../lib/parse-proc-cpuinfo')

/**
 * Most functionality is covered in-depth via cross-agent tests in
 * test/integration/pricing/proc_cpuinfo.tap.js
 */

test('Should return object with null processor stats when data is null', (t) => {
  const expectedStats = {
    logical: null,
    cores: null,
    packages: null
  }

  const result = parseCpuInfo(null)

  t.same(result, expectedStats)

  t.end()
})

test('Should return object with null processor stats when data is undefined', (t) => {
  const expectedStats = {
    logical: null,
    cores: null,
    packages: null
  }

  const result = parseCpuInfo(undefined)

  t.same(result, expectedStats)

  t.end()
})
