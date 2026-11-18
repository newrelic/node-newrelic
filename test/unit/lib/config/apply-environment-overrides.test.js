/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { applyEnvironmentOverrides } = require('#agentlib/config/apply-environment-overrides.js')

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

  await t.test('applies the numericOrString coercion for transaction_threshold', () => {
    // A numeric value parses to a number so the trace aggregator's
    // `typeof === 'number'` check honors it; a sentinel string is left alone.
    const numeric = apply({ NEW_RELIC_TRACER_THRESHOLD: '0.5' })
    assert.strictEqual(typeof numeric.transaction_tracer.transaction_threshold, 'number')
    assert.equal(numeric.transaction_tracer.transaction_threshold, 0.5)

    const sentinel = apply({ NEW_RELIC_TRACER_THRESHOLD: 'apdex_f' })
    assert.strictEqual(sentinel.transaction_tracer.transaction_threshold, 'apdex_f')
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

test('OTEL env var mapping', async (t) => {
  function applyOtel(env) {
    return applyEnvironmentOverrides({ opentelemetry: { enabled: true } }, { env })
  }

  await t.test('is a no-op when opentelemetry.enabled is absent', () => {
    const config = applyEnvironmentOverrides({}, { env: { OTEL_SERVICE_NAME: 'my-service' } })
    assert.ok(!config.app_name)
  })

  await t.test('is a no-op when opentelemetry.enabled is false', () => {
    const config = applyEnvironmentOverrides(
      { opentelemetry: { enabled: false } },
      { env: { OTEL_SERVICE_NAME: 'my-service' } }
    )
    assert.ok(!config.app_name)
  })

  await t.test('maps OTEL_SERVICE_NAME to app_name', () => {
    const config = applyOtel({ OTEL_SERVICE_NAME: 'my-service' })
    assert.equal(config.app_name, 'my-service')
  })

  await t.test('maps OTEL_LOG_LEVEL to logging.level, lowercased', () => {
    const config = applyOtel({ OTEL_LOG_LEVEL: 'INFO' })
    assert.equal(config.logging.level, 'info')
  })

  await t.test('treats OTEL_LOG_LEVEL as case-insensitive for every recognized level', () => {
    const config = applyOtel({ OTEL_LOG_LEVEL: 'WaRn' })
    assert.equal(config.logging.level, 'warn')
  })

  await t.test('ignores an unrecognized OTEL_LOG_LEVEL and warns', () => {
    const seen = []
    const logger = { trace: () => {}, debug: () => {}, warn: (msg, ...args) => seen.push(args) }
    const config = applyEnvironmentOverrides(
      { opentelemetry: { enabled: true } },
      { env: { OTEL_LOG_LEVEL: 'VERBOSE' }, logger }
    )
    assert.ok(!config.logging)
    assert.deepStrictEqual(seen, [['OTEL_LOG_LEVEL', 'VERBOSE']])
  })

  await t.test('falls back to the already-resolved logging.level when OTEL_LOG_LEVEL is unrecognized', () => {
    // Simulates a value already resolved from file config/NEW_RELIC_LOG_LEVEL/the
    // schema default before this runs; an invalid OTel value must not clobber it.
    const config = applyEnvironmentOverrides(
      { opentelemetry: { enabled: true }, logging: { level: 'debug' } },
      { env: { OTEL_LOG_LEVEL: 'VERBOSE' } }
    )
    assert.equal(config.logging.level, 'debug')
  })

  await t.test('maps OTEL_SDK_DISABLED=true to agent_enabled=false', () => {
    const config = applyOtel({ OTEL_SDK_DISABLED: 'true' })
    assert.equal(config.agent_enabled, false)
  })

  await t.test('maps OTEL_SDK_DISABLED=false to agent_enabled=true', () => {
    const config = applyOtel({ OTEL_SDK_DISABLED: 'false' })
    assert.equal(config.agent_enabled, true)
  })

  await t.test('runs OTEL_SDK_DISABLED through boolean formatter', () => {
    const config = applyOtel({ OTEL_SDK_DISABLED: 'no' })
    assert.equal(config.agent_enabled, true)
  })

  await t.test('prefers NEW_RELIC_APP_NAME over OTEL_SERVICE_NAME', () => {
    const config = applyOtel({ NEW_RELIC_APP_NAME: 'nr-app', OTEL_SERVICE_NAME: 'otel-app' })
    assert.equal(config.app_name, 'nr-app')
  })

  await t.test('prefers NEW_RELIC_LOG_LEVEL over OTEL_LOG_LEVEL', () => {
    const config = applyOtel({ NEW_RELIC_LOG_LEVEL: 'warn', OTEL_LOG_LEVEL: 'DEBUG' })
    assert.equal(config.logging.level, 'warn')
  })

  await t.test('prefers NEW_RELIC_ENABLED over OTEL_SDK_DISABLED', () => {
    // Alone, OTEL_SDK_DISABLED=false would flip to agent_enabled=true; NEW_RELIC_ENABLED
    // disagrees and must win.
    const config = applyOtel({ NEW_RELIC_ENABLED: 'false', OTEL_SDK_DISABLED: 'false' })
    assert.equal(config.agent_enabled, false)
  })

  await t.test('treats an empty NEW_RELIC_ENABLED as unset, so OTEL_SDK_DISABLED applies', () => {
    const config = applyOtel({ NEW_RELIC_ENABLED: '', OTEL_SDK_DISABLED: 'true' })
    assert.equal(config.agent_enabled, false)
  })

  await t.test('ignores an unmapped OTEL_ variable', () => {
    const config = applyOtel({ OTEL_RESOURCE_ATTRIBUTES: 'foo=bar' })
    assert.deepStrictEqual(config, { opentelemetry: { enabled: true } })
  })

  await t.test('treats an empty OTEL_SERVICE_NAME as unset', () => {
    const config = applyOtel({ OTEL_SERVICE_NAME: '' })
    assert.ok(!('app_name' in config))
  })

  await t.test('logs unmapped OTEL_ variables found in the environment', () => {
    const seen = []
    const logger = { trace: () => {}, debug: (msg, names) => seen.push(names) }
    applyEnvironmentOverrides(
      { opentelemetry: { enabled: true } },
      { env: { OTEL_RESOURCE_ATTRIBUTES: 'foo=bar', OTEL_TRACES_EXPORTER: 'otlp' }, logger }
    )
    assert.equal(seen.length, 1)
    assert.ok(seen[0].includes('OTEL_RESOURCE_ATTRIBUTES'))
    assert.ok(seen[0].includes('OTEL_TRACES_EXPORTER'))
  })

  await t.test('does not mention a mapped OTEL_ variable in the unmapped log line', () => {
    const seen = []
    const logger = { trace: () => {}, debug: (msg, names) => seen.push(names) }
    applyEnvironmentOverrides(
      { opentelemetry: { enabled: true } },
      { env: { OTEL_SERVICE_NAME: 'my-service', OTEL_RESOURCE_ATTRIBUTES: 'foo=bar' }, logger }
    )
    assert.equal(seen.length, 1)
    assert.ok(!seen[0].includes('OTEL_SERVICE_NAME'))
  })

  await t.test('does not log when every OTEL_ variable present is mapped', () => {
    const seen = []
    const logger = { trace: () => {}, debug: (msg, names) => seen.push(names) }
    applyEnvironmentOverrides(
      { opentelemetry: { enabled: true } },
      { env: { OTEL_SERVICE_NAME: 'my-service' }, logger }
    )
    assert.deepStrictEqual(seen, [])
  })

  await t.test('does not log when no OTEL_ variables are present', () => {
    const seen = []
    const logger = { trace: () => {}, debug: (msg, names) => seen.push(names) }
    applyEnvironmentOverrides({ opentelemetry: { enabled: true } }, { env: {}, logger })
    assert.deepStrictEqual(seen, [])
  })
})

test('env var index', async (t) => {
  const schema = require('#agentlib/config/schema.js')

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
