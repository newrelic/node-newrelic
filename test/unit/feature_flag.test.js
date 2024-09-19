/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const flags = require('../../lib/feature_flags')
const Config = require('../../lib/config')

// Please do not delete flags from here.
const used = [
  'internal_test_only',

  'async_local_context',
  'await_support',
  'cat',
  'custom_instrumentation',
  'custom_metrics',
  'express_segments',
  'legacy_context_manager',
  'native_metrics',
  'new_promise_tracking',
  'promise_segments',
  'protocol_17',
  'serverless_mode',
  'released',
  'reverse_naming_rules',
  'send_request_uri_attribute',
  'synthetics',
  'dt_format_w3c',
  'unreleased',
  'fastify_instrumentation',
  'certificate_bundle',
  'unresolved_promise_cleanup',
  'undici_instrumentation',
  'undici_async_tracking',
  'aws_bedrock_instrumentation',
  'langchain_instrumentation',
  'kafkajs_instrumentation'
]

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.prerelease = Object.keys(flags.prerelease)
  ctx.nr.unreleased = [...flags.unreleased]
  ctx.nr.released = [...flags.released]

  ctx.nr.setLogger = Config.prototype.setLogger
})

test.afterEach((ctx) => {
  Config.prototype.setLogger = ctx.nr.setLogger
})

test('should declare every prerelease feature in the *used* variable', (t) => {
  for (const key of t.nr.prerelease) {
    assert.equal(used.includes(key), true)
  }
})

test('should declare every release feature in the *used* variable', (t) => {
  for (const key of t.nr.released) {
    assert.equal(used.includes(key), true)
  }
})

test('should declare every unreleased feature in the *used* variable', (t) => {
  for (const key of t.nr.unreleased) {
    assert.equal(used.includes(key), true)
  }
})

test('should not re-declare a flag in prerelease from released', (t) => {
  const { prerelease, released } = t.nr
  const filtered = prerelease.filter((n) => released.includes(n))
  assert.equal(filtered.length, 0)
})

test('should not re-declare a flag in prerelease from unreleased', (t) => {
  const { prerelease, unreleased } = t.nr
  const filtered = prerelease.filter((n) => unreleased.includes(n))
  assert.equal(filtered.length, 0)
})

test('should account for all *used* keys', (t) => {
  const { released, unreleased, prerelease } = t.nr
  for (const key of used) {
    if (released.includes(key) === true) {
      continue
    }
    if (unreleased.includes(key) === true) {
      continue
    }
    if (prerelease.includes(key) === true) {
      continue
    }
    throw Error(`Flag "${key}" not accounted for.`)
  }
})

test('should warn if released flags are still in config', () => {
  let called = false
  Config.prototype.setLogger({
    warn() {
      called = true
    },
    warnOnce() {}
  })
  const config = new Config()
  config.feature_flag.released = true
  config.validateFlags()
  assert.equal(called, true)
})

test('should warn if unreleased flags are still in config', () => {
  let called = false
  Config.prototype.setLogger({
    warn() {
      called = true
    },
    warnOnce() {}
  })
  const config = new Config()
  config.feature_flag.unreleased = true
  config.validateFlags()
  assert.equal(called, true)
})
