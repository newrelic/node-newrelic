/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')
const Config = require('#agentlib/config/index.js')
const AdaptiveSampler = require('#agentlib/samplers/adaptive-sampler.js')
const AlwaysOnSampler = require('#agentlib/samplers/always-on-sampler.js')
const AlwaysOffSampler = require('#agentlib/samplers/always-off-sampler.js')
const TraceIdRatioBasedSampler = require('#agentlib/samplers/ratio-based-sampler.js')
const determineSampler = require('#agentlib/samplers/determine-sampler.js')

test.beforeEach((ctx) => {
  ctx.nr = {}
})

test.afterEach((ctx) => {
  if (ctx.nr.agent) helper.unloadAgent(ctx.nr.agent)
})

test('should throw error if agent is null', (t) => {
  assert.throws(() => {
    determineSampler({ agent: null, config: t.nr.agent.config })
  })
})

test('should throw error if config is null', (t) => {
  assert.throws(() => {
    determineSampler({ agent: t.nr.agent, config: null })
  })
})

test('root sampler', async (t) => {
  await t.test('should choose adaptive sampler by default', (t) => {
    const config = new Config({})
    t.nr.agent = helper.loadMockedAgent(config)
    const sampler = t.nr.agent.sampler.root
    assert.ok(sampler instanceof AdaptiveSampler)
  })

  await t.test('should choose adaptive sampler if specified', (t) => {
    const config = new Config({
      distributed_tracing: {
        sampler: {
          root: 'adaptive'
        }
      }
    })
    t.nr.agent = helper.loadMockedAgent(config)
    const sampler = t.nr.agent.sampler.root
    assert.ok(sampler instanceof AdaptiveSampler)
  })

  await t.test('should use AlwaysOnSampler if always_on is specified', (t) => {
    const config = new Config({
      distributed_tracing: {
        sampler: {
          root: 'always_on'
        }
      }
    })
    t.nr.agent = helper.loadMockedAgent(config)
    const sampler = t.nr.agent.sampler.root
    assert.ok(sampler instanceof AlwaysOnSampler)
  })

  await t.test('should use AlwaysOffSampler if always_off is specified', (t) => {
    const config = new Config({
      distributed_tracing: {
        sampler: {
          root: 'always_off'
        }
      }
    })
    t.nr.agent = helper.loadMockedAgent(config)
    const sampler = t.nr.agent.sampler.root
    assert.ok(sampler instanceof AlwaysOffSampler)
  })
})

test('agent.sampler.remoteParentSampled is determined correctly', async (t) => {
  await t.test('should choose adaptive sampler by default', (t) => {
    const config = new Config({})
    t.nr.agent = helper.loadMockedAgent(config)
    const sampler = t.nr.agent.sampler.remoteParentSampled
    assert.ok(sampler instanceof AdaptiveSampler)
  })

  await t.test('should choose adaptive sampler if specified', (t) => {
    const config = new Config({
      distributed_tracing: {
        sampler: {
          remote_parent_sampled: 'adaptive'
        }
      }
    })
    t.nr.agent = helper.loadMockedAgent(config)
    const sampler = t.nr.agent.sampler.remoteParentSampled
    assert.ok(sampler instanceof AdaptiveSampler)
  })

  await t.test('should use AlwaysOnSampler if always_on is specified', (t) => {
    const config = new Config({
      distributed_tracing: {
        sampler: {
          remote_parent_sampled: 'always_on'
        }
      }
    })
    t.nr.agent = helper.loadMockedAgent(config)
    const sampler = t.nr.agent.sampler.remoteParentSampled
    assert.ok(sampler instanceof AlwaysOnSampler)
  })

  await t.test('should use AlwaysOffSampler if always_off is specified', (t) => {
    const config = new Config({
      distributed_tracing: {
        sampler: {
          remote_parent_sampled: 'always_off'
        }
      }
    })
    t.nr.agent = helper.loadMockedAgent(config)
    const sampler = t.nr.agent.sampler.remoteParentSampled
    assert.ok(sampler instanceof AlwaysOffSampler)
  })
})

test('agent.sampler.remoteParentNotSampled is determined correctly', async (t) => {
  await t.test('should choose adaptive sampler by default', (t) => {
    const config = new Config({})
    t.nr.agent = helper.loadMockedAgent(config)
    const sampler = t.nr.agent.sampler.remoteParentNotSampled
    assert.ok(sampler instanceof AdaptiveSampler)
  })

  await t.test('should choose adaptive sampler if specified', (t) => {
    const config = new Config({
      distributed_tracing: {
        sampler: {
          remote_parent_not_sampled: 'adaptive'
        }
      }
    })
    t.nr.agent = helper.loadMockedAgent(config)
    const sampler = t.nr.agent.sampler.remoteParentNotSampled
    assert.ok(sampler instanceof AdaptiveSampler)
  })

  await t.test('should use AlwaysOnSampler if always_on is specified', (t) => {
    const config = new Config({
      distributed_tracing: {
        sampler: {
          remote_parent_not_sampled: 'always_on'
        }
      }
    })
    t.nr.agent = helper.loadMockedAgent(config)
    const sampler = t.nr.agent.sampler.remoteParentNotSampled
    assert.ok(sampler instanceof AlwaysOnSampler)
  })

  await t.test('should use AlwaysOffSampler if always_off is specified', (t) => {
    const config = new Config({
      distributed_tracing: {
        sampler: {
          remote_parent_not_sampled: 'always_off'
        }
      }
    })
    t.nr.agent = helper.loadMockedAgent(config)
    const sampler = t.nr.agent.sampler.remoteParentNotSampled
    assert.ok(sampler instanceof AlwaysOffSampler)
  })
})

test('if trace_id_ratio_based is defined but ratio is not, use adaptive sampler', (t) => {
  const config = new Config({
    distributed_tracing: {
      sampler: {
        root: {
          trace_id_ratio_based: {
            // ratio explicitly not defined
          }
        }
      }
    }
  })
  t.nr.agent = helper.loadMockedAgent(config)
  const sampler = t.nr.agent.transactionSampler
  assert.ok(sampler instanceof AdaptiveSampler)
})

test('should use traceidratiobasedsampler if trace_id_ratio_based and ratio is defined', (t) => {
  const config = new Config({
    distributed_tracing: {
      sampler: {
        root: {
          trace_id_ratio_based: {
            ratio: 0.3
          }
        }
      }
    }
  })
  t.nr.agent = helper.loadMockedAgent(config)
  const sampler = t.nr.agent.transactionSampler
  assert.ok(sampler instanceof TraceIdRatioBasedSampler)
})
