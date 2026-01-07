/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/* eslint-disable camelcase */
const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const helper = require('#testlib/agent_helper.js')
const testCases = require('#testlib/cross_agent_tests/samplers/harvest_sampling_rates.json')

const TRANSPORT = 'HTTP'
const TRACESTATE_SAMPLED = '33@nr=0-0-33-2827902-0af7651916cd43dd--1--1518469636035'
const TRACESTATE_DIFF_ACCT = '44@nr=0-0-44-2827902-0af7651916cd43dd--1-1.2-1518469636035'

function createTraceParent(sampled) {
  const traceId = helper.generateRandomTraceId()
  let traceParent = `00-${traceId}-00f067aa0ba902b7-`
  if (sampled) {
    traceParent += '01'
  } else {
    traceParent += '00'
  }

  return traceParent
}

function generateTransactions({ agent, num, tracestate, sampled }) {
  for (let i = 0; i < num; i++) {
    helper.runInTransaction(agent, (tx) => {
      if (tracestate) {
        const traceparent = createTraceParent(sampled)
        tx.acceptDistributedTraceHeaders(TRANSPORT, { tracestate, traceparent })
      }
      tx.end()
    })
  }
}

for (const testCase of testCases) {
  test(testCase.test_name, (t) => {
    const {
      root = 0,
      parent_sampled_no_matching_acct_id = 0,
      parent_not_sampled_no_matching_acct_id = 0,
      parent_not_sampled_matching_acct_id_sampled_true = 0,
      parent_sampled_matching_acct_id_sampled_true = 0,
    } = testCase
    const agent = helper.instrumentMockedAgent({
      distributed_tracing: {
        ...testCase.config
      }
    })

    if (agent.samplers.adaptiveSampler) {
      sinon.spy(agent.samplers.adaptiveSampler, 'shouldSample')
    }
    agent.config.trusted_account_key = 33
    agent.config.account_id = 33
    agent.config.primary_application_id = 4657

    t.after(() => {
      helper.unloadAgent(agent)
    })

    generateTransactions({ agent, num: root })
    generateTransactions({ agent, num: parent_sampled_matching_acct_id_sampled_true, tracestate: TRACESTATE_SAMPLED, sampled: true })
    generateTransactions({ agent, num: parent_sampled_no_matching_acct_id, tracestate: TRACESTATE_DIFF_ACCT, sampled: true })
    generateTransactions({ agent, num: parent_not_sampled_matching_acct_id_sampled_true, tracestate: TRACESTATE_SAMPLED })
    generateTransactions({ agent, num: parent_not_sampled_no_matching_acct_id, tracestate: TRACESTATE_DIFF_ACCT })

    const data = agent.transactionEventAggregator.getEvents()

    if (testCase.expected_adaptive_sampler_decisions) {
      assert.equal(testCase.expected_adaptive_sampler_decisions, agent.samplers.adaptiveSampler.shouldSample.callCount)
    }
    const sampled = data.filter((tx) => tx[0].sampled === true)
    const fullSampled = sampled.filter((tx) => tx[0].priority >= 2.000001)
    const partialSampled = sampled.filter((tx) => tx[0].priority >= 1.000000 && tx[0].priority <= 2.000000)
    if (testCase.variance) {
      assertRange({ sampled, expected: testCase.expected_sampled, variance: testCase.variance })
      assertRange({ sampled: fullSampled, expected: testCase.expected_sampled_full, variance: testCase.variance, type: 'full' })
      assertRange({ sampled: partialSampled, expected: testCase.expected_sampled_partial, variance: testCase.variance, type: 'partial' })
    } else {
      assert.equal(sampled.length, testCase.expected_sampled)
      assert.equal(fullSampled.length, testCase.expected_sampled_full)
      assert.equal(partialSampled.length, testCase.expected_sampled_partial)
    }
  })
}

function assertRange({ sampled, expected, variance, type = 'total' }) {
  const allowableExpected = expected * variance
  const upperBound = expected + allowableExpected
  const lowerBound = expected - allowableExpected
  assert.ok(sampled.length <= upperBound && sampled.length >= lowerBound, `should sample ${type} with variance, actual ${sampled.length}, expected: ${expected}, lowerBound: ${lowerBound}, upperBound: ${upperBound}`)
}
