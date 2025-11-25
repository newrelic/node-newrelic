/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const Config = require('#agentlib/config/index.js')
const Samplers = require('#agentlib/samplers/index.js')
const AdaptiveSampler = require('#agentlib/samplers/adaptive-sampler.js')
const AlwaysOnSampler = require('#agentlib/samplers/always-on-sampler.js')
const AlwaysOffSampler = require('#agentlib/samplers/always-off-sampler.js')
const TraceIdRatioBasedSampler = require('#agentlib/samplers/ratio-based-sampler.js')

function beforeEach(ctx) {
  const config = Config.createInstance({})
  const mockAgent = { config }
  ctx.nr = { agent: mockAgent }
}

test('Samplers constructor', async (t) => {
  t.beforeEach(beforeEach)
  await t.test('should initialize with default samplers', (t) => {
    const samplers = new Samplers(t.nr.agent)
    assert.ok(samplers instanceof Samplers)
    assert.ok(samplers.root instanceof AdaptiveSampler)
    assert.ok(samplers.remoteParentSampled instanceof AdaptiveSampler)
    assert.ok(samplers.remoteParentNotSampled instanceof AdaptiveSampler)
  })

  await t.test('should initialize adaptiveSampler to null', (t) => {
    const samplers = new Samplers(t.nr.agent)
    // adaptiveSampler is created lazily by getAdaptiveSampler
    assert.ok(samplers.adaptiveSampler !== null)
  })

  await t.test('should call determineSampler for each sampler type', (t) => {
    t.nr.agent.config = {
      distributed_tracing: {
        sampler: {
          root: 'always_on',
          remote_parent_sampled: 'always_off',
          remote_parent_not_sampled: 'always_on'
        }
      }
    }

    const samplers = new Samplers(t.nr.agent)

    assert.ok(samplers.root instanceof AlwaysOnSampler)
    assert.ok(samplers.remoteParentSampled instanceof AlwaysOffSampler)
    assert.ok(samplers.remoteParentNotSampled instanceof AlwaysOnSampler)
  })

  await t.test('should use different samplers for different types', (t) => {
    t.nr.agent.config = {
      distributed_tracing: {
        sampler: {
          root: 'always_on',
          remote_parent_sampled: {
            trace_id_ratio_based: {
              ratio: 0.5
            }
          },
          remote_parent_not_sampled: 'always_off'
        }
      }
    }
    const samplers = new Samplers(t.nr.agent)

    assert.ok(samplers.root instanceof AlwaysOnSampler)
    assert.ok(samplers.remoteParentSampled instanceof TraceIdRatioBasedSampler)
    assert.ok(samplers.remoteParentNotSampled instanceof AlwaysOffSampler)
  })

  await t.test('should share global adaptive sampler across multiple sampler types', (t) => {
    const samplers = new Samplers(t.nr.agent)

    assert.equal(samplers.root, samplers.adaptiveSampler)
    assert.equal(samplers.remoteParentSampled, samplers.adaptiveSampler)
    assert.equal(samplers.remoteParentNotSampled, samplers.adaptiveSampler)
  })

  await t.test('should create separate adaptive samplers when sampling_target differs', (t) => {
    t.nr.agent.config = new Config({
      sampling_target: 10,
      distributed_tracing: {
        sampler: {
          root: {
            adaptive: {
              sampling_target: 25
            }
          },
          remote_parent_sampled: {
            adaptive: {
              sampling_target: 50
            }
          },
          remote_parent_not_sampled: 'adaptive'
        }
      }
    })
    const samplers = new Samplers(t.nr.agent)

    assert.ok(samplers.root instanceof AdaptiveSampler)
    assert.ok(samplers.remoteParentSampled instanceof AdaptiveSampler)
    assert.ok(samplers.remoteParentNotSampled instanceof AdaptiveSampler)

    assert.equal(samplers.root.samplingTarget, 25)
    assert.equal(samplers.remoteParentSampled.samplingTarget, 50)
    assert.equal(samplers.remoteParentNotSampled.samplingTarget, 10)

    assert.notEqual(samplers.root, samplers.remoteParentSampled)
    assert.notEqual(samplers.root, samplers.remoteParentNotSampled)
    assert.notEqual(samplers.remoteParentSampled, samplers.remoteParentNotSampled)
    assert.equal(samplers.remoteParentNotSampled, samplers.adaptiveSampler)
  })
})

test('applySamplingDecision', async (t) => {
  t.beforeEach(beforeEach)
  await t.test('should apply sampling decision for root type by default', (t) => {
    const samplers = new Samplers(t.nr.agent)

    const transaction = { priority: null, sampled: null }
    samplers.applySamplingDecision(transaction)

    assert.ok(transaction.priority !== null)
    assert.ok(typeof transaction.sampled === 'boolean')
  })

  await t.test('should not apply sampling decision if priority is already set', (t) => {
    const samplers = new Samplers(t.nr.agent)

    const transaction = { priority: 1.5, sampled: true }
    samplers.applySamplingDecision(transaction)

    assert.equal(transaction.priority, 1.5)
    assert.equal(transaction.sampled, true)
  })

  await t.test('should handle missing transaction gracefully', (t) => {
    const samplers = new Samplers(t.nr.agent)

    assert.doesNotThrow(() => {
      samplers.applySamplingDecision()
    })
  })
})

test('applyDTSamplingDecision', async (t) => {
  t.beforeEach(beforeEach)
  await t.test('should apply remoteParentSampled when traceparent is sampled', (t) => {
    t.nr.agent.config = new Config({
      distributed_tracing: {
        sampler: {
          remote_parent_sampled: 'always_on'
        }
      }
    })
    const samplers = new Samplers(t.nr.agent)

    const transaction = { priority: null, sampled: null }
    const traceparent = { isSampled: true }

    samplers.applyDTSamplingDecision({ transaction, traceparent })

    assert.equal(transaction.sampled, true)
    assert.equal(transaction.priority, 2.0)
  })

  await t.test('should not crash when a transaction does not exist for remoteParentSampled', (t) => {
    t.nr.agent.config = new Config({
      distributed_tracing: {
        sampler: {
          remote_parent_sampled: 'always_on'
        }
      }
    })
    const samplers = new Samplers(t.nr.agent)

    const traceparent = { isSampled: true }

    assert.doesNotThrow(() => {
      samplers.applyDTSamplingDecision({ traceparent })
    })
  })

  await t.test('should apply remoteParentNotSampled when traceparent is not sampled', (t) => {
    t.nr.agent.config = new Config({
      distributed_tracing: {
        sampler: {
          remote_parent_not_sampled: 'always_off'
        }
      }
    })
    const samplers = new Samplers(t.nr.agent)

    const transaction = { priority: null, sampled: null }
    const traceparent = { isSampled: false }

    samplers.applyDTSamplingDecision({ transaction, traceparent })

    assert.equal(transaction.sampled, false)
    assert.equal(transaction.priority, 0)
  })

  await t.test('should not crash when a transaction does not exist for remoteParentNotSampled', (t) => {
    t.nr.agent.config = new Config({
      distributed_tracing: {
        sampler: {
          remote_parent_not_sampled: 'always_off'
        }
      }
    })
    const samplers = new Samplers(t.nr.agent)

    const traceparent = { isSampled: false }

    assert.doesNotThrow(() => {
      samplers.applyDTSamplingDecision({ traceparent })
    })
  })

  await t.test('should not apply decision when traceparent.isSampled is undefined', (t) => {
    const samplers = new Samplers(t.nr.agent)

    const transaction = { priority: null, sampled: null }
    const traceparent = { isSampled: undefined }
    const tracestate = null

    samplers.applyDTSamplingDecision({ transaction, traceparent, tracestate })

    assert.equal(transaction.priority, null)
    assert.equal(transaction.sampled, null)
  })

  await t.test('should handle tracestate without intrinsics', (t) => {
    t.nr.agent.config = new Config({
      distributed_tracing: {
        sampler: {
          remote_parent_sampled: 'always_on'
        }
      }
    })
    const samplers = new Samplers(t.nr.agent)

    const transaction = { priority: null, sampled: null }
    const traceparent = { isSampled: true }
    const tracestate = null

    samplers.applyDTSamplingDecision({ transaction, traceparent, tracestate })

    assert.equal(transaction.sampled, true)
    assert.equal(transaction.priority, 2.0)
  })
})

test('applyLegacyDTSamplingDecision', async (t) => {
  t.beforeEach(beforeEach)
  await t.test('should apply remoteParentSampled when isSampled is true', (t) => {
    t.nr.agent.config = new Config({
      distributed_tracing: {
        sampler: {
          remote_parent_sampled: 'always_on'
        }
      }
    })
    const samplers = new Samplers(t.nr.agent)

    const transaction = { priority: null, sampled: null }
    samplers.applyLegacyDTSamplingDecision({ transaction, isSampled: true })

    assert.equal(transaction.sampled, true)
    assert.equal(transaction.priority, 2.0)
  })

  await t.test('should apply remoteParentNotSampled when isSampled is false', (t) => {
    t.nr.agent.config = new Config({
      distributed_tracing: {
        sampler: {
          remote_parent_not_sampled: 'always_off'
        }
      }
    })
    const samplers = new Samplers(t.nr.agent)

    const transaction = { priority: null, sampled: null }
    samplers.applyLegacyDTSamplingDecision({ transaction, isSampled: false })

    assert.equal(transaction.sampled, false)
    assert.equal(transaction.priority, 0)
  })

  await t.test('should NOT apply decision when sampler is AdaptiveSampler and isSampled is true', (t) => {
    const samplers = new Samplers(t.nr.agent)

    const transaction = { priority: null, sampled: null }
    samplers.applyLegacyDTSamplingDecision({ transaction, isSampled: true })

    assert.equal(transaction.priority, null)
    assert.equal(transaction.sampled, null)
  })

  await t.test('should NOT apply decision when sampler is AdaptiveSampler and isSampled is false', (t) => {
    const samplers = new Samplers(t.nr.agent)

    const transaction = { priority: null, sampled: null }
    samplers.applyLegacyDTSamplingDecision({ transaction, isSampled: false })

    assert.equal(transaction.priority, null)
    assert.equal(transaction.sampled, null)
  })

  await t.test('should apply decision when sampler is not AdaptiveSampler', (t) => {
    t.nr.agent.config = new Config({
      distributed_tracing: {
        sampler: {
          remote_parent_sampled: 'always_on',
          remote_parent_not_sampled: 'always_off'
        }
      }
    })
    const samplers = new Samplers(t.nr.agent)

    const transaction1 = { priority: null, sampled: null }
    samplers.applyLegacyDTSamplingDecision({ transaction: transaction1, isSampled: true })
    assert.equal(transaction1.sampled, true)

    const transaction2 = { priority: null, sampled: null }
    samplers.applyLegacyDTSamplingDecision({ transaction: transaction2, isSampled: false })
    assert.equal(transaction2.sampled, false)
  })
})

test('updateAdaptiveTarget', async (t) => {
  t.beforeEach(beforeEach)
  await t.test('should update adaptive sampler target when it exists', (t) => {
    const samplers = new Samplers(t.nr.agent)

    const originalTarget = samplers.adaptiveSampler.samplingTarget
    samplers.updateAdaptiveTarget(50)

    assert.equal(samplers.adaptiveSampler.samplingTarget, 50)
    assert.notEqual(samplers.adaptiveSampler.samplingTarget, originalTarget)
    assert.equal(samplers.adaptiveSampler._maxSamples, 100)
  })

  await t.test('should not throw when adaptive sampler does not exist', (t) => {
    const samplers = new Samplers(t.nr.agent)
    samplers.adaptiveSampler = null

    assert.doesNotThrow(() => {
      samplers.updateAdaptiveTarget(50)
    })
  })
})

test('updateAdaptivePeriod', async (t) => {
  t.beforeEach(beforeEach)
  await t.test('should update adaptive sampler period when it exists', (t) => {
    const samplers = new Samplers(t.nr.agent)

    samplers.updateAdaptivePeriod(120)

    assert.equal(samplers.adaptiveSampler.samplingPeriod, 120000)
  })

  await t.test('should not throw when adaptive sampler does not exist', (t) => {
    const samplers = new Samplers(t.nr.agent)
    samplers.adaptiveSampler = null

    assert.doesNotThrow(() => {
      samplers.updateAdaptivePeriod(60)
    })
  })
})

test('getAdaptiveSampler', async (t) => {
  t.beforeEach(beforeEach)
  await t.test('should create adaptive sampler if it does not exist', (t) => {
    const samplers = new Samplers(t.nr.agent)
    samplers.adaptiveSampler = null

    const sampler = samplers.getAdaptiveSampler(t.nr.agent)

    assert.ok(sampler instanceof AdaptiveSampler)
    assert.equal(samplers.adaptiveSampler, sampler)
  })

  await t.test('should return existing adaptive sampler if it exists', (t) => {
    const samplers = new Samplers(t.nr.agent)

    const sampler1 = samplers.getAdaptiveSampler(t.nr.agent)
    const sampler2 = samplers.getAdaptiveSampler(t.nr.agent)

    assert.equal(sampler1, sampler2)
  })

  await t.test('should use config values for sampler initialization', (t) => {
    t.nr.agent.config.sampling_target = 25
    t.nr.agent.config.sampling_target_period_in_seconds = 150
    const samplers = new Samplers(t.nr.agent)
    samplers.adaptiveSampler = null

    const sampler = samplers.getAdaptiveSampler(t.nr.agent)

    assert.equal(sampler.samplingTarget, 25)
    assert.equal(sampler.samplingPeriod, 150000)
  })

  await t.test('should respect serverless_mode setting', (t) => {
    t.nr.agent.on = () => {}
    t.nr.agent.config = new Config({
      serverless_mode: { enabled: true }
    })
    const samplers = new Samplers(t.nr.agent)
    samplers.adaptiveSampler = null

    const sampler = samplers.getAdaptiveSampler(t.nr.agent)

    assert.ok(sampler._serverless)
  })
})
