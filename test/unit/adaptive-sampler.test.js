/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const helper = require('../lib/agent_helper')
const AdaptiveSampler = require('../../lib/adaptive-sampler')
const expect = require('chai').expect
const sinon = require('sinon')

describe('AdaptiveSampler', () => {
  let sampler = null
  const shared = {
    'should count the number of traces sampled': () => {
      expect(sampler.sampled).to.equal(0)
      expect(sampler.shouldSample(0.1234)).to.be.true
      expect(sampler.sampled).to.equal(1)
    },

    'should not sample transactions with priorities lower than the min': () => {
      expect(sampler.sampled).to.equal(0)
      sampler._samplingThreshold = 0.5
      expect(sampler.shouldSample(0)).to.be.false
      expect(sampler.sampled).to.equal(0)
      expect(sampler.shouldSample(1)).to.be.true
      expect(sampler.sampled).to.equal(1)
    },

    'should adjust the min priority when throughput increases': () => {
      sampler._reset(sampler.samplingTarget)
      sampler._seen = 2 * sampler.samplingTarget
      sampler._adjustStats(sampler.samplingTarget)
      expect(sampler.samplingThreshold).to.equal(0.5)
    },

    'should only take the first 10 on the first harvest': () => {
      expect(sampler.samplingThreshold).to.equal(0)

      // Change this to maxSampled if we change the way the back off works.
      for (let i = 0; i <= 2 * sampler.samplingTarget; ++i) {
        sampler.shouldSample(0.99999999)
      }

      expect(sampler.sampled).to.equal(10)
      expect(sampler.samplingThreshold).to.equal(1)
    },

    'should backoff on sampling after reaching the sampled target': () => {
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
        0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9,
        0.316227766016838, 0.5500881229337736, 0.6957797474657306,
        0.7910970452225743, 0.8559144986383691, 0.9013792551037068,
        0.9340820391176599, 0.9580942670418969, 0.976025777575764,
        0.9896031249412947, 1.0
      ]

      // Change this to maxSampled if we change the way the back off works.
      for (let i = 0; i <= 2 * sampler.samplingTarget; ++i) {
        const expected = expectedMSP[i]
        expect(sampler.samplingThreshold)
          .to.be.within(expected - epsilon, expected + epsilon)

        sampler.shouldSample(Infinity)
      }
    }
  }

  describe('in serverless mode', () => {
    let agent = null
    beforeEach(() => {
      agent = helper.loadMockedAgent({
        serverless_mode: {
          enabled: true
        }
      })
      sampler = agent.transactionSampler
    })

    afterEach(() => {
      helper.unloadAgent(agent)
      sampler = null
    })

    Object.getOwnPropertyNames(shared).forEach((testName) => {
      it(testName, shared[testName])
    })

    it(
      'should reset itself after a transaction outside the window has been created',
      (done) => {
        const spy = sinon.spy(sampler, '_reset')
        sampler.samplingPeriod = 50
        expect(spy.callCount).to.equal(0)
        agent.emit('transactionStarted', {timer: {start: Date.now()}})
        expect(spy.callCount).to.equal(1)

        setTimeout(() => {
          expect(spy.callCount).to.equal(1)
          agent.emit('transactionStarted', {timer: {start: Date.now()}})
          expect(spy.callCount).to.equal(2)
          done()
        }, 100)
      }
    )
  })

  describe('in standard mode', () => {
    beforeEach(() => {
      sampler = new AdaptiveSampler({
        period: 100,
        target: 10
      })
    })

    afterEach(() => {
      sampler.samplePeriod = 0 // Clear sample interval.
    })

    Object.getOwnPropertyNames(shared).forEach((testName) => {
      it(testName, shared[testName])
    })

    it('should reset itself according to the period', (done) => {
      const spy = sinon.spy(sampler, '_reset')
      sampler.samplingPeriod = 50

      setTimeout(() => {
        expect(spy.callCount).to.equal(4)
        done()
      }, 235)
    })
  })
})
