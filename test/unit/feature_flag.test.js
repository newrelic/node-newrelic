/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const flags = require('../../lib/feature_flags')
const Config = require('../../lib/config')

// please do not delete flags from here
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
  'langchain_instrumentation'
]

tap.test('feature flags', (t) => {
  t.beforeEach(async (t) => {
    t.context.prerelease = Object.keys(flags.prerelease)
    t.context.unreleased = [...flags.unreleased]
    t.context.released = [...flags.released]
  })

  t.test('should declare every prerelease feature in the *used* variable', async (t) => {
    t.context.prerelease.forEach((key) => {
      t.equal(used.includes(key), true)
    })
  })

  t.test('should declare every release feature in the *used* variable', async (t) => {
    t.context.released.forEach((key) => {
      t.equal(used.includes(key), true)
    })
  })

  t.test('should declare every unrelease feature in the *used* variable', async (t) => {
    t.context.unreleased.forEach((key) => {
      t.equal(used.includes(key), true)
    })
  })

  t.test('should not re-declare a flag in prerelease from released', async (t) => {
    const { prerelease, released } = t.context
    const filtered = prerelease.filter((n) => released.includes(n))
    t.equal(filtered.length, 0)
  })

  t.test('should not re-declare a flag in prerelease from unreleased', async (t) => {
    const { prerelease, unreleased } = t.context
    const filtered = prerelease.filter((n) => unreleased.includes(n))
    t.equal(filtered.length, 0)
  })

  t.test('should account for all *used* keys', async (t) => {
    const { released, unreleased, prerelease } = t.context
    used.forEach((key) => {
      if (released.includes(key) === true) {
        return
      }
      if (unreleased.includes(key) === true) {
        return
      }
      if (prerelease.includes(key) === true) {
        return
      }

      throw Error('Flag not accounted for')
    })
  })

  t.test('should warn if released flags are still in config', async (t) => {
    let called = false
    Config.prototype.setLogger({
      warn: () => {
        called = true
      },
      warnOnce: () => {}
    })
    const config = new Config()
    config.feature_flag.released = true
    config.validateFlags()
    t.equal(called, true)
  })

  t.test('should warn if unreleased flags are still in config', async (t) => {
    let called = false
    Config.prototype.setLogger({
      warn: () => {
        called = true
      },
      warnOnce: () => {}
    })
    const config = new Config()
    config.feature_flag.unreleased = true
    config.validateFlags()
    t.equal(called, true)
  })

  t.end()
})
