/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')
const Config = require('#agentlib/config/index.js')
const AdaptiveSampler = require('#agentlib/samplers/adaptive-sampler.js')
const TraceIdRatioBasedSampler = require('#agentlib/samplers/ratio-based-sampler.js')
const determineSampler = require('#agentlib/samplers/determine-sampler.js')

test.beforeEach((ctx) => {
  ctx.nr = {}
})

test.afterEach((ctx) => {
  if (ctx.nr.agent)helper.unloadAgent(ctx.nr.agent)
})

test('should throw error if agent or config is null', (t) => {
  assert.throws(() => {
    determineSampler({ agent: null, config: null })
  })
})

test('should choose adaptive sampler by default', (t) => {
  const config = new Config({})
  t.nr.agent = helper.loadMockedAgent(config)
  const sampler = t.nr.agent.transactionSampler
  assert.ok(sampler instanceof AdaptiveSampler)
})

test('if trace_id_ratio_based and ratio is not configured, use adaptive sampler', (t) => {
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
