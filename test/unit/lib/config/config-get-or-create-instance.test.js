/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const CONFIG_PATH = require.resolve('#agentlib/config/index.js')

// `getOrCreateInstance` caches a module-level instance, so each test loads a
// fresh copy of the config module to avoid leaking that singleton between tests
// (and between this file and the rest of the config suite).
function freshConfig() {
  delete require.cache[CONFIG_PATH]
  return require(CONFIG_PATH)
}

test.afterEach(() => {
  // Ensure the next requirer of the config module gets a clean copy.
  delete require.cache[CONFIG_PATH]
})

test('getOrCreateInstance returns a disabled stub when initialization throws', (t) => {
  const Config = freshConfig()

  // Force the failure path: construction can throw on invalid discovered config.
  Config.initialize = () => {
    throw new Error('boom: invalid configuration')
  }

  // The stub path logs the error to the console; silence it for the test.
  const originalConsoleError = console.error
  console.error = () => {}
  t.after(() => {
    console.error = originalConsoleError
  })

  const config = Config.getOrCreateInstance()

  assert.equal(config.agent_enabled, false, 'stub disables the agent')
  assert.equal(config.logging.enabled, true, 'stub keeps logging enabled')
  assert.equal(config.logging.filepath, 'stdout', 'stub logs to stdout')
  // The stub is still seeded from the generated defaults.
  assert.deepEqual(config.app_name, [], 'stub carries default settings')
})

test('getOrCreateInstance caches the instance across calls', (t) => {
  const Config = freshConfig()
  Config.initialize = () => {
    throw new Error('boom')
  }
  const originalConsoleError = console.error
  console.error = () => {}
  t.after(() => {
    console.error = originalConsoleError
  })

  const first = Config.getOrCreateInstance()
  const second = Config.getOrCreateInstance()
  assert.equal(first, second, 'subsequent calls return the cached instance')
})

test('getOrCreateInstance returns the initialized config on success', (t) => {
  const Config = freshConfig()

  const built = { agent_enabled: true, marker: 'built-config' }
  Config.initialize = () => built

  const config = Config.getOrCreateInstance()
  assert.equal(config, built, 'returns the instance produced by initialize')
  assert.equal(Config.getOrCreateInstance(), built, 'and caches it')
})
