/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const Config = require('../../../lib/config')

test.beforeEach((ctx) => {
  ctx.nr = {}
  // Make sure we don't pollute our logs
  ctx.nr.originalConsoleError = global.console.error
  global.console.error = () => {}
})

test.afterEach((ctx) => {
  global.console.error = ctx.nr.originalConsoleError
})

test('should gracefully handle errors on instantiation', (t) => {
  t.after(() => {
    delete process.env.NEW_RELIC_NO_CONFIG_FILE
    delete process.env.NEW_RELIC_HOME
    delete process.env.NEW_RELIC_HIGH_SECURITY
    delete process.env.NEW_RELIC_SECURITY_POLICIES_TOKEN
  })

  process.env.NEW_RELIC_NO_CONFIG_FILE = 'true'
  process.env.NEW_RELIC_HOME = '/xxxnoexist/nofile'
  process.env.NEW_RELIC_HIGH_SECURITY = 'true'
  process.env.NEW_RELIC_SECURITY_POLICIES_TOKEN = 'faketoken-noexist'

  const config = Config.getOrCreateInstance()
  assert.equal(config.agent_enabled, false, 'should disable the agent on error')
  assert.deepEqual(
    config.logging,
    { enabled: true, filepath: 'stdout' },
    'should default the logging configuration on error'
  )
})
