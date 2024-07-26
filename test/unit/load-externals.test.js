/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const loadExternals = require('../../load-externals')

tap.test('should load libs to webpack externals', async (t) => {
  const config = {
    target: 'node-20.x',
    externals: ['next']
  }
  loadExternals(config)
  t.ok(config.externals.length > 1, 'should add all libraries agent supports to the externals list')
})

tap.test('should not add externals when target is not node', async (t) => {
  const config = {
    target: 'web',
    externals: ['next']
  }
  loadExternals(config)
  t.ok(config.externals.length === 1, 'should not agent libraries when target is not node')
})
