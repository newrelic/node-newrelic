/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const loadExternals = require('../../load-externals')

test('should load libs to webpack externals', async () => {
  const config = {
    target: 'node-20.x',
    externals: ['test-pkg']
  }
  loadExternals(config)
  // This number is arbitrary but accounts for legacy instrumentation + subscriber instrumentation
  assert.ok(
    config.externals.length > 40,
    `should add all libraries agent supports to the externals list, got ${config.externals.length}`
  )
})

test('should not add externals when target is not node', async () => {
  const config = {
    target: 'web',
    externals: ['test-pkg']
  }
  loadExternals(config)
  assert.ok(config.externals.length === 1, 'should not agent libraries when target is not node')
})
