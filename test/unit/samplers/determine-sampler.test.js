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
const determineSampler = require('#agentlib/samplers/determine-sampler.js')

test.beforeEach((ctx) => {
  ctx.nr = {}
})

test.afterEach((ctx) => {
  if (ctx.nr.agent) helper.unloadAgent(ctx.nr.agent)
})

// TODO: works for agent.sampler.remoteParentSampled and agent.sampler.remoteParentNotSampled

test('should throw error if agent or config is null', (t) => {
  assert.throws(() => {
    determineSampler({ agent: null, config: null })
  })
})

test('should choose adaptive sampler by default', (t) => {
  const config = new Config({})
  t.nr.agent = helper.loadMockedAgent(config)
  const sampler = t.nr.agent.sampler.root
  assert.ok(sampler instanceof AdaptiveSampler)
})

test('should choose adaptive sampler if specified', (t) => {
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

test('should use AlwaysOnSampler if always_on is specified', (t) => {
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

test('should use AlwaysOffSampler if always_off is specified', (t) => {
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
