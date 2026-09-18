/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { applyEnvironmentOverrides } = require('../../../lib/config/apply-environment-overrides')

function apply(env, extra = {}) {
  return applyEnvironmentOverrides({}, { env, ...extra })
}

test('applyEnvironmentOverrides', async (t) => {
  await t.test('maps a convention-named variable to its nested path', () => {
    const config = apply({ NEW_RELIC_ATTRIBUTES_ENABLED: 'false' })
    assert.equal(config.attributes.enabled, false)
  })

  await t.test('resolves a deep multi-underscore path', () => {
    const config = apply({ NEW_RELIC_CUSTOM_INSIGHTS_EVENTS_MAX_SAMPLES_STORED: '5' })
    assert.equal(config.custom_insights_events.max_samples_stored, 5)
    assert.equal(typeof config.custom_insights_events.max_samples_stored, 'number')
  })

  await t.test('coerces to the leaf schema type', () => {
    const config = apply({
      NEW_RELIC_PORT: '8080', // integer
      NEW_RELIC_APDEX_T: '0.25', // number
      NEW_RELIC_ATTRIBUTES_INCLUDE: 'a, b', // array
      NEW_RELIC_HIGH_SECURITY: 'true' // boolean
    })
    assert.equal(config.port, 8080)
    assert.equal(config.apdex_t, 0.25)
    assert.deepStrictEqual(config.attributes.include, ['a', 'b'])
    assert.equal(config.high_security, true)
  })

  await t.test('distinguishes sibling keys that are name-prefixes of one another', () => {
    // `proxy` uses the explicit NEW_RELIC_PROXY_URL; proxy_host/proxy_port use
    // their derived names. Each resolves to its own leaf, none bleeding onto another.
    const config = apply({
      NEW_RELIC_PROXY_URL: 'p',
      NEW_RELIC_PROXY_HOST: 'h',
      NEW_RELIC_PROXY_PORT: '9000'
    })
    assert.equal(config.proxy, 'p')
    assert.equal(config.proxy_host, 'h')
    assert.equal(config.proxy_port, '9000')
  })

  await t.test('disambiguates include vs include_enabled', () => {
    const config = apply({
      NEW_RELIC_ATTRIBUTES_INCLUDE: 'x',
      NEW_RELIC_ATTRIBUTES_INCLUDE_ENABLED: 'true'
    })
    assert.deepStrictEqual(config.attributes.include, ['x'])
    assert.equal(config.attributes.include_enabled, true)
  })

  await t.test('honors explicit x-newrelic-env-var overrides', () => {
    const config = apply({
      NEW_RELIC_ENABLED: 'false', // agent_enabled
      NEW_RELIC_LOG_ENABLED: 'false', // logging.enabled
      NEW_RELIC_TRACER_ENABLED: 'false' // transaction_tracer.enabled
    })
    assert.equal(config.agent_enabled, false)
    assert.equal(config.logging.enabled, false)
    assert.equal(config.transaction_tracer.enabled, false)
    // the override must not also leak onto a convention path
    assert.ok(!('logging' in config) || !('logging_enabled' in config))
  })

  await t.test('skips and logs unrecognized NEW_RELIC_ variables', () => {
    const seen = []
    const logger = { debug: (msg, name) => seen.push(name) }
    const config = applyEnvironmentOverrides({}, { env: { NEW_RELIC_NOT_A_SETTING: 'x' }, logger })
    assert.deepStrictEqual(config, {})
    assert.deepStrictEqual(seen, ['NEW_RELIC_NOT_A_SETTING'])
  })

  await t.test('ignores non-NEW_RELIC variables', () => {
    const config = apply({ PATH: '/usr/bin', HOME: '/root' })
    assert.deepStrictEqual(config, {})
  })

  await t.test('leaves the config untouched when no variables are set', () => {
    assert.deepStrictEqual(apply({}), {})
  })
})

test('env var index', async (t) => {
  const schema = require('../../../lib/config/schema')

  // buildEnvVarIndex (in schema.js) throws if two leaves map to the same env
  // var name. The first resolveEnvVar call builds it, so a future schema
  // addition that introduces a collision fails loudly here.
  await t.test('builds without a name collision', () => {
    assert.doesNotThrow(() => schema.resolveEnvVar('NEW_RELIC_PORT'))
  })

  await t.test('resolves a convention-derived name', () => {
    assert.deepStrictEqual(schema.resolveEnvVar('NEW_RELIC_PORT').pathSegments, ['port'])
  })

  await t.test('resolves an explicit x-newrelic-env-var override name', () => {
    assert.deepStrictEqual(schema.resolveEnvVar('NEW_RELIC_LOG_ENABLED').pathSegments, [
      'logging',
      'enabled'
    ])
  })

  await t.test('returns undefined for an unrecognized name', () => {
    assert.equal(schema.resolveEnvVar('NEW_RELIC_NOT_REAL'), undefined)
  })
})
