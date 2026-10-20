/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const Config = require('#agentlib/config/index.js')
const HealthReporter = require('#agentlib/health-reporter.js')
const findStartupBlockers = require('#agentlib/config/find-startup-blockers.js')

/**
 * Builds a Config without touching the global singleton.
 *
 * @param {object} input The raw configuration object.
 *
 * @returns {object} The constructed Config instance.
 */
function buildConfig(input) {
  return new Config(input)
}

test('returns no blockers for a startable configuration', () => {
  const config = buildConfig({
    app_name: ['My Application'],
    license_key: 'license key here'
  })

  assert.deepEqual(findStartupBlockers(config), [])
})

test('flags a missing app_name', () => {
  const config = buildConfig({ license_key: 'license key here' })
  const blockers = findStartupBlockers(config)

  assert.equal(blockers.length, 1)
  assert.equal(blockers[0].key, 'app_name')
  assert.equal(blockers[0].healthStatus, HealthReporter.STATUS_MISSING_APP_NAME)
})

test('flags a missing license_key outside serverless mode', () => {
  const config = buildConfig({ app_name: ['My Application'] })
  const blockers = findStartupBlockers(config)

  assert.equal(blockers.length, 1)
  assert.equal(blockers[0].key, 'license_key')
  assert.equal(blockers[0].healthStatus, HealthReporter.STATUS_LICENSE_KEY_MISSING)
})

test('does not flag a missing license_key in serverless mode', () => {
  const config = buildConfig({
    app_name: ['My Application'],
    serverless_mode: { enabled: true }
  })

  assert.deepEqual(findStartupBlockers(config), [])
})

test('flags a disabled agent', () => {
  const config = buildConfig({
    app_name: ['My Application'],
    license_key: 'license key here',
    agent_enabled: false
  })
  const blockers = findStartupBlockers(config)

  assert.equal(blockers.length, 1)
  assert.equal(blockers[0].key, 'agent_enabled')
  assert.equal(blockers[0].healthStatus, HealthReporter.STATUS_AGENT_DISABLED)
})

test('returns multiple blockers in a stable order', () => {
  const config = buildConfig({ agent_enabled: false })
  const keys = findStartupBlockers(config).map((blocker) => blocker.key)

  assert.deepEqual(keys, [
    'agent_enabled',
    'app_name',
    'license_key'
  ])
})

test('evaluates only the requested field', () => {
  // A config that would trip every blocker, but only app_name is requested.
  const config = buildConfig({ agent_enabled: false })
  const blockers = findStartupBlockers(config, 'app_name')

  assert.equal(blockers.length, 1)
  assert.equal(blockers[0].key, 'app_name')
})

test('does not throw on a partial configuration', () => {
  // A bare object missing applications()/serverless_mode/license_key must yield
  // blockers rather than throwing.
  const keys = findStartupBlockers({ agent_enabled: true }).map((blocker) => blocker.key)

  assert.deepEqual(keys, [
    'app_name',
    'license_key'
  ])
})
