/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')

const helper = require('../../lib/agent_helper')
const AdaptiveSampler = require('../../../lib/samplers/adaptive-sampler')

const shared = {
  'should count the number of traces sampled': (t) => {
    const { sampler } = t.nr
    assert.equal(sampler.sampled, 0)
    assert.ok(sampler.shouldSample(0.1234))
    assert.equal(sampler.sampled, 1)
  },

  'should not sample transactions with priorities lower than the min': (t) => {
    const { sampler } = t.nr
    assert.equal(sampler.sampled, 0)
    sampler._samplingThreshold = 0.5
    assert.equal(sampler.shouldSample(0), false)
    assert.equal(sampler.sampled, 0)
    assert.ok(sampler.shouldSample(1))
    assert.equal(sampler.sampled, 1)
  },

  'should adjust the min priority when throughput increases': (t) => {
    const { sampler } = t.nr
    sampler._reset(sampler.samplingTarget)
    sampler._seen = 2 * sampler.samplingTarget
    sampler._adjustStats(sampler.samplingTarget)
    assert.equal(sampler.samplingThreshold, 0.5)
  },

  'should only take the first 10 on the first harvest': (t) => {
    const { sampler } = t.nr
    assert.equal(sampler.samplingThreshold, 0)

    // Change this to maxSampled if we change the way the back off works.
    for (let i = 0; i <= 2 * sampler.samplingTarget; ++i) {
      sampler.shouldSample(0.99999999)
    }

    assert.equal(sampler.sampled, 10)
    assert.equal(sampler.samplingThreshold, 1)
  },

  'should backoff on sampling after reaching the sampled target': (t) => {
    const { sampler } = t.nr
    sampler._seen = 10 * sampler.samplingTarget

    // Flag the sampler as not in the first period
    sampler._reset()

    // The minimum sampled priority is not adjusted until the `target` number of
    // transactions have been sampled, this is why the first 10 checks are all
    // 0.9. At that point the current count of seen transactions should be close
    // to the previous period's transaction count.
    //
    // In this test, however, the seen for this period is small compared the
    // previous period (10 vs 100). This causes the MSP to drop to 0.3 but
    // quickly normalizes again. This is an artifact of the test's use of infinite
    // priority transactions in order to make the test predictable.
    const epsilon = 0.000001
    const expectedMSP = [
      0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.316227766016838, 0.5500881229337736,
      0.6957797474657306, 0.7910970452225743, 0.8559144986383691, 0.9013792551037068,
      0.9340820391176599, 0.9580942670418969, 0.976025777575764, 0.9896031249412947, 1.0
    ]

    // Change this to maxSampled if we change the way the back off works.
    for (let i = 0; i <= 2 * sampler.samplingTarget; ++i) {
      const expected = expectedMSP[i]
      assert.ok(
        sampler.samplingThreshold >= expected - epsilon &&
          sampler.samplingThreshold <= expected + epsilon
      )

      sampler.shouldSample(Infinity)
    }
  }
}

test('in serverless mode', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({
      serverless_mode: { enabled: true }
    })
    ctx.nr.sampler = ctx.nr.agent.transactionSampler
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  for (const [name, fn] of Object.entries(shared)) {
    await t.test(name, fn)
  }

  await t.test(
    'should reset itself after a transaction outside the window has been created',
    async (t) => {
      const { agent, sampler } = t.nr
      const spy = sinon.spy(sampler, '_reset')
      sampler.samplingPeriod = 50
      assert.equal(spy.callCount, 0)
      agent.emit('transactionStarted', { timer: { start: Date.now() } })
      assert.equal(spy.callCount, 1)

      await new Promise((resolve) => {
        setTimeout(() => {
          assert.equal(spy.callCount, 1)
          agent.emit('transactionStarted', { timer: { start: Date.now() } })
          assert.equal(spy.callCount, 2)
          resolve()
        }, 100)
      })
    }
  )
})

test('in standard mode', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.sampler = new AdaptiveSampler({ period: 100, target: 10 })
  })

  for (const [name, fn] of Object.entries(shared)) {
    await t.test(name, fn)
  }

  await t.test('should reset itself according to the period', async (t) => {
    const { sampler } = t.nr
    const spy = sinon.spy(sampler, '_reset')
    sampler.samplingPeriod = 50

    await new Promise((resolve) => {
      setTimeout(() => {
        assert.equal(spy.callCount, 4)
        resolve()
      }, 235)
    })
  })
})
