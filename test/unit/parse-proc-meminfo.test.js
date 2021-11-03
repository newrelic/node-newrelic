/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')

const parseMemInfo = require('../../lib/parse-proc-meminfo')

/**
 * Most functionality is covered in-depth via cross-agent tests in
 * test/integration/pricing/proc_meminfo.tap.js
 */

test('Should return `null` when data is null', (t) => {
  const result = parseMemInfo(null)

  t.same(result, null)

  t.end()
})

test('Should return `null` when data is undefined', (t) => {
  const result = parseMemInfo(undefined)

  t.same(result, undefined)

  t.end()
})
