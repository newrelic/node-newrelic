/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { buildSamplers, setSamplersFromEnv, isValidDTSampler } = require('#agentlib/config/samplers.js')

function testLogger() {
  const traces = []
  return {
    traces,
    trace(...args) {
      traces.push(args)
    }
  }
}

// A setNestedKey implementation matching the one Config supplies: creates
// intermediate objects and assigns the value at the final path segment.
function setNestedKey(obj, keys, value) {
  let cursor = obj
  for (let i = 0; i < keys.length - 1; i++) {
    cursor[keys[i]] = cursor[keys[i]] || {}
    cursor = cursor[keys[i]]
  }
  cursor[keys[keys.length - 1]] = value
}

test('isValidDTSampler', () => {
  assert.equal(isValidDTSampler('sampler'), true)
  assert.equal(isValidDTSampler('partial_granularity'), true)
  assert.equal(isValidDTSampler('root'), false)
  assert.equal(isValidDTSampler('nope'), false)
})

test('buildSamplers', async (t) => {
  await t.test('does nothing for a key that is not a distributed tracing sampler', () => {
    const logger = testLogger()
    const configToUpdate = {}
    buildSamplers({ config: { nope: {} }, key: 'nope', configToUpdate, logger })
    assert.deepEqual(configToUpdate, {}, 'leaves the target untouched')
  })

  await t.test('sets a trace_id_ratio_based sampler when a ratio is provided', () => {
    const logger = testLogger()
    const configToUpdate = { sampler: {} }
    buildSamplers({
      config: { sampler: { root: { trace_id_ratio_based: { ratio: 0.5 } } } },
      key: 'sampler',
      configToUpdate,
      logger
    })
    assert.deepEqual(configToUpdate.sampler.root, { trace_id_ratio_based: { ratio: 0.5 } })
  })

  await t.test('does not set a trace_id_ratio_based sampler when the ratio is absent', () => {
    const logger = testLogger()
    const configToUpdate = { sampler: {} }
    buildSamplers({
      config: { sampler: { root: { trace_id_ratio_based: {} } } },
      key: 'sampler',
      configToUpdate,
      logger
    })
    assert.equal(configToUpdate.sampler.root, undefined, 'the sampler is left unset')
    assert.ok(
      logger.traces.some(([msg]) => String(msg).includes('ratio value is not present')),
      'logs that the ratio was absent'
    )
  })

  await t.test('sets an adaptive sampler when sampling_target is in range', () => {
    const logger = testLogger()
    const configToUpdate = { sampler: {} }
    buildSamplers({
      config: { sampler: { root: { adaptive: { sampling_target: 30 } } } },
      key: 'sampler',
      configToUpdate,
      logger
    })
    assert.deepEqual(configToUpdate.sampler.root, { adaptive: { sampling_target: 30 } })
  })

  await t.test('does not set an adaptive sampler when sampling_target is out of range', () => {
    const logger = testLogger()
    const configToUpdate = { sampler: {} }
    buildSamplers({
      config: { sampler: { root: { adaptive: { sampling_target: 121 } } } },
      key: 'sampler',
      configToUpdate,
      logger
    })
    assert.equal(configToUpdate.sampler.root, undefined, 'the sampler is left unset')
    assert.ok(
      logger.traces.some(([msg]) => String(msg).includes('not in range [1,120]')),
      'logs that the target was out of range'
    )
  })
})

test('setSamplersFromEnv', async (t) => {
  await t.test('does nothing when paths is empty', () => {
    const logger = testLogger()
    let called = false
    setSamplersFromEnv({
      key: 'root',
      config: {},
      paths: [],
      setNestedKey: () => {
        called = true
      },
      logger
    })
    assert.equal(called, false, 'never touches the config')
  })

  await t.test('does nothing when the last path is not a sampler container', () => {
    const logger = testLogger()
    let called = false
    setSamplersFromEnv({
      key: 'root',
      config: {},
      paths: ['distributed_tracing', 'not_a_sampler'],
      setNestedKey: () => {
        called = true
      },
      logger
    })
    assert.equal(called, false, 'never touches the config')
  })

  await t.test('does nothing when the key is not a valid sampler type', () => {
    const logger = testLogger()
    let called = false
    setSamplersFromEnv({
      key: 'not_a_type',
      config: { distributed_tracing: { sampler: { not_a_type: 'trace_id_ratio_based' } } },
      paths: ['distributed_tracing', 'sampler'],
      setNestedKey: () => {
        called = true
      },
      logger
    })
    assert.equal(called, false, 'never touches the config')
  })

  await t.test('expands a trace_id_ratio_based string using its ratio env var', (t) => {
    const logger = testLogger()
    const envVar = 'NEW_RELIC_DISTRIBUTED_TRACING_SAMPLER_ROOT_TRACE_ID_RATIO_BASED_RATIO'
    process.env[envVar] = '0.25'
    t.after(() => {
      delete process.env[envVar]
    })

    const config = { distributed_tracing: { sampler: { root: 'trace_id_ratio_based' } } }
    setSamplersFromEnv({
      key: 'root',
      config,
      paths: ['distributed_tracing', 'sampler'],
      setNestedKey,
      logger
    })
    assert.deepEqual(config.distributed_tracing.sampler.root, { trace_id_ratio_based: { ratio: 0.25 } })
  })

  await t.test('expands an adaptive string using its sampling_target env var', (t) => {
    const logger = testLogger()
    const envVar = 'NEW_RELIC_DISTRIBUTED_TRACING_SAMPLER_ROOT_ADAPTIVE_SAMPLING_TARGET'
    process.env[envVar] = '30'
    t.after(() => {
      delete process.env[envVar]
    })

    const config = { distributed_tracing: { sampler: { root: 'adaptive' } } }
    setSamplersFromEnv({
      key: 'root',
      config,
      paths: ['distributed_tracing', 'sampler'],
      setNestedKey,
      logger
    })
    assert.deepEqual(config.distributed_tracing.sampler.root, { adaptive: { sampling_target: 30 } })
  })

  await t.test('falls back to adaptive when the trace_id_ratio_based env var is absent', () => {
    const logger = testLogger()
    const config = { distributed_tracing: { sampler: { root: 'trace_id_ratio_based' } } }
    setSamplersFromEnv({
      key: 'root',
      config,
      paths: ['distributed_tracing', 'sampler'],
      setNestedKey,
      logger
    })
    assert.equal(config.distributed_tracing.sampler.root, 'adaptive')
  })

  await t.test('falls back to adaptive when the sampling_target env var is out of range', (t) => {
    const logger = testLogger()
    const envVar = 'NEW_RELIC_DISTRIBUTED_TRACING_SAMPLER_ROOT_ADAPTIVE_SAMPLING_TARGET'
    process.env[envVar] = '500'
    t.after(() => {
      delete process.env[envVar]
    })

    const config = { distributed_tracing: { sampler: { root: 'adaptive' } } }
    setSamplersFromEnv({
      key: 'root',
      config,
      paths: ['distributed_tracing', 'sampler'],
      setNestedKey,
      logger
    })
    assert.equal(config.distributed_tracing.sampler.root, 'adaptive')
  })

  await t.test('creates intermediate path objects when the config lacks them', () => {
    const logger = testLogger()
    // The config does not contain the `distributed_tracing.sampler` path, so
    // resolving the current value must create the intermediate objects.
    const config = {}
    setSamplersFromEnv({
      key: 'root',
      config,
      paths: ['distributed_tracing', 'sampler'],
      setNestedKey,
      logger
    })
    assert.deepEqual(config.distributed_tracing.sampler, {}, 'intermediate objects are created')
  })
})
