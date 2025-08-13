/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// The purpose of this test is to verify that the agent will refuse to start
// when any required Open Telemetry packages are not available and the bridge
// is supposed to be enabled. The idea being, we can remove the OTEL packages
// and start the agent with the bridge disabled in order to trim the size of
// AWS Lambda Layers.

const test = require('node:test')
const assert = require('node:assert')
const Module = require('node:module')
const proxyquire = require('proxyquire')

test('logs warning when missing otel packages', () => {
  process.env.NEW_RELIC_OPENTELEMETRY_BRIDGE_ENABLED = true

  require.resolve = function resolve (...args) {
    if (args[0].startsWith('@opentelemetry') === true) {
      const error = Error('boom')
      error.code = 'ERR_MODULE_NOT_FOUND'
      throw error
    }
    return require.resolve.apply(require, args)
  }
  Module.createRequire = function () {
    return require
  }

  const logs = []
  const agent = proxyquire('../../index.js', {
    './lib/logger': {
      info() {},
      debug() {},
      warn(...args) {
        logs.push(args)
      }
    }
  })
  assert.ok(agent)
  agent.shutdown()
  assert.deepEqual(logs, [['OpenTelemetry bridge enabled, but packages are missing. Not starting!']])
})
