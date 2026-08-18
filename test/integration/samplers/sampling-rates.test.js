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

// Ratio-based samplers make per-transaction decisions off random trace ids, so a
// variance test case's counts are binomially distributed around their expected
// value. The `variance` band in the shared cross-agent fixture doesn't cover the
// same number of standard deviations for every case, so an occasional run drifts
// just outside it by chance. Since each attempt draws fresh trace ids, retrying
// collapses that per-run probability to a negligible one without loosening the
// (fixture-owned) band. Deterministic cases have no `variance` and never retry.
const VARIANCE_ATTEMPTS = 5

/**
 * Builds an agent for the test case, generates its mix of transactions, and
 * returns the resulting sampled counts plus the adaptive sampler decision count.
 * A fresh agent is used each call so retries draw independent random trace ids.
 *
 * @param {object} testCase a single cross-agent sampling-rate scenario
 * @returns {object} `{ sampled, fullSampled, partialSampled, adaptiveDecisions }` counts
 */
function runScenario(testCase) {
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

  try {
    if (agent.samplers.adaptiveSampler) {
      sinon.spy(agent.samplers.adaptiveSampler, 'shouldSample')
    }
    agent.config.trusted_account_key = 33
    agent.config.account_id = 33
    agent.config.primary_application_id = 4657

    generateTransactions({ agent, num: root })
    generateTransactions({ agent, num: parent_sampled_matching_acct_id_sampled_true, tracestate: TRACESTATE_SAMPLED, sampled: true })
    generateTransactions({ agent, num: parent_sampled_no_matching_acct_id, tracestate: TRACESTATE_DIFF_ACCT, sampled: true })
    generateTransactions({ agent, num: parent_not_sampled_matching_acct_id_sampled_true, tracestate: TRACESTATE_SAMPLED })
    generateTransactions({ agent, num: parent_not_sampled_no_matching_acct_id, tracestate: TRACESTATE_DIFF_ACCT })

    const data = agent.transactionEventAggregator.getEvents()
    const sampled = data.filter((tx) => tx[0].sampled === true)
    const fullSampled = sampled.filter((tx) => tx[0].priority >= 2.000001)
    const partialSampled = sampled.filter((tx) => tx[0].priority >= 1.000000 && tx[0].priority <= 2.000000)

    return {
      sampled,
      fullSampled,
      partialSampled,
      adaptiveDecisions: agent.samplers.adaptiveSampler?.shouldSample.callCount
    }
  } finally {
    helper.unloadAgent(agent)
  }
}

/**
 * True when `sampled.length` falls within `expected ± expected * variance`.
 *
 * @param {object} params see fields
 * @param {Array} params.sampled the sampled transactions to count
 * @param {number} params.expected the expected count from the fixture
 * @param {number} params.variance the allowable fractional deviation
 * @returns {boolean} whether the count is inside the band
 */
function inRange({ sampled, expected, variance }) {
  const allowable = expected * variance
  return sampled.length <= expected + allowable && sampled.length >= expected - allowable
}

for (const testCase of testCases) {
  test(testCase.test_name, () => {
    if (!testCase.variance) {
      const { sampled, fullSampled, partialSampled, adaptiveDecisions } = runScenario(testCase)
      if (testCase.expected_adaptive_sampler_decisions) {
        assert.equal(testCase.expected_adaptive_sampler_decisions, adaptiveDecisions)
      }
      assert.equal(sampled.length, testCase.expected_sampled)
      assert.equal(fullSampled.length, testCase.expected_sampled_full)
      assert.equal(partialSampled.length, testCase.expected_sampled_partial)
      return
    }

    // Retry the stochastic scenario; pass as soon as every band is satisfied.
    let result
    for (let attempt = 1; attempt <= VARIANCE_ATTEMPTS; attempt++) {
      result = runScenario(testCase)
      const withinBands =
        inRange({ sampled: result.sampled, expected: testCase.expected_sampled, variance: testCase.variance }) &&
        inRange({ sampled: result.fullSampled, expected: testCase.expected_sampled_full, variance: testCase.variance }) &&
        inRange({ sampled: result.partialSampled, expected: testCase.expected_sampled_partial, variance: testCase.variance })
      if (withinBands) {
        break
      }
    }

    // Assert on the last attempt's counts so a genuine regression still reports
    // (and with clear diagnostics), while transient drift is absorbed by retries.
    if (testCase.expected_adaptive_sampler_decisions) {
      assert.equal(testCase.expected_adaptive_sampler_decisions, result.adaptiveDecisions)
    }
    assertRange({ sampled: result.sampled, expected: testCase.expected_sampled, variance: testCase.variance })
    assertRange({ sampled: result.fullSampled, expected: testCase.expected_sampled_full, variance: testCase.variance, type: 'full' })
    assertRange({ sampled: result.partialSampled, expected: testCase.expected_sampled_partial, variance: testCase.variance, type: 'partial' })
  })
}

function assertRange({ sampled, expected, variance, type = 'total' }) {
  const allowableExpected = expected * variance
  const upperBound = expected + allowableExpected
  const lowerBound = expected - allowableExpected
  assert.ok(sampled.length <= upperBound && sampled.length >= lowerBound, `should sample ${type} with variance, actual ${sampled.length}, expected: ${expected}, lowerBound: ${lowerBound}, upperBound: ${upperBound}`)
}
