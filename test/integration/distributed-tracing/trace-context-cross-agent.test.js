/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { TYPES } = require('../../../lib/transaction')
const API = require('../../../api')
const Traceparent = require('#agentlib/w3c/traceparent.js')
const Tracestate = require('#agentlib/w3c/tracestate.js')
const helper = require('../../lib/agent_helper')
const recorder = require('../../../lib/metrics/recorders/distributed-trace')
const recordSupportability = require('../../../lib/agent').prototype.recordSupportability
const { buildSamplerConfig, forceAdaptiveSamplers } = require('./helpers')
const { assertEvents, assertMetrics, assertOutboundPayloads, expectedFixtureKeys } = require('./custom-assertions')

test('distributed tracing trace context', async (t) => {
  const testCases = require('../../lib/cross_agent_tests/distributed_tracing/trace_context.json')
  for (const testCase of testCases) {
    await runTestCase(testCase, t)
  }
})

async function runTestCase(testCase, parentTest) {
  // validates the test case data has what we're looking for.  Good for
  // catching any changes to the test format over time, as well as becoming
  // familiar with what we need to do to implement a test runner
  await parentTest.test('validate test: ' + testCase.test_name, (t, end) => {
    expectedFixtureKeys(testCase, [
      'account_id',
      'expected_metrics',
      'inbound_headers',
      'intrinsics',
      'outbound_payloads',
      'raises_exception',
      'span_events_enabled',
      'test_name',
      'transport_type',
      'trusted_account_key',
      'web_transaction',
      'comment',
      'transaction_events_enabled',
      // Sampling
      'distributed_tracing_enabled',
      'full_granularity_enabled',
      'force_adaptive_sampled',
      'remote_parent_sampled',
      'remote_parent_not_sampled',
      'root',
      'full_granularity_ratio',
      'partial_granularity_enabled',
      'partial_granularity_root',
      'partial_granularity_remote_parent_sampled',
      'partial_granularity_remote_parent_not_sampled',
      'partial_granularity_ratio',
      'expected_priority_between'
    ])

    if (testCase.outbound_payloads) {
      for (const outboundPayload of testCase.outbound_payloads) {
        expectedFixtureKeys(outboundPayload, [
          'exact',
          'expected',
          'notequal',
          'vendors',
          'unexpected'
        ])
      }
    }

    if (testCase.intrinsics) {
      // top level intrinsics keys
      expectedFixtureKeys(testCase.intrinsics, [
        'Transaction',
        'Span',
        'common',
        'target_events',
        'TransactionError'
      ])

      expectedFixtureKeys(testCase.intrinsics.common, ['exact', 'unexpected', 'expected'])

      // test there are no unexpected event types in there
      const expectedEvents = ['Span', 'Transaction', 'TransactionError']
      expectedFixtureKeys(testCase.intrinsics.target_events, expectedEvents)

      // test the top level keys of each event
      for (const event of testCase.intrinsics.target_events) {
        const eventTestConfig = testCase.intrinsics[event]

        // a few tests list an expected event, but no data for that event
        if (!eventTestConfig) {
          continue
        }
        expectedFixtureKeys(eventTestConfig, ['exact', 'unexpected', 'expected'])
      }
    }
    end()
  })

  await parentTest.test('trace context: ' + testCase.test_name, (t, end) => {
    const initConfig = buildSamplerConfig(testCase)
    const agent = helper.instrumentMockedAgent(initConfig)
    agent.recordSupportability = recordSupportability
    agent.config.trusted_account_key = testCase.trusted_account_key
    agent.config.account_id = testCase.account_id
    agent.config.primary_application_id = 4657
    agent.config.span_events.enabled = testCase.span_events_enabled
    agent.config.transaction_events.enabled = testCase.transaction_events_enabled

    t.after(() => helper.unloadAgent(agent))

    const agentApi = new API(agent)

    const transactionType = testCase.web_transaction ? TYPES.WEB : TYPES.BG

    helper.runInTransaction(agent, transactionType, function (transaction) {
      transaction.baseSegment = transaction.trace.add('MyBaseSegment', (segment) => {
        recorder(
          transaction,
          testCase.web_transaction ? 'Web' : 'Other',
          segment.getDurationInMillis(),
          segment.getExclusiveDurationInMillis()
        )
      })

      // Check to see if the test runner should throw an error
      if (testCase.raises_exception) {
        agentApi.noticeError(new Error('should error'))
      }

      forceAdaptiveSamplers(agent, testCase.force_adaptive_sampled)

      for (const inboundHeader of testCase.inbound_headers.values()) {
        transaction.acceptDistributedTraceHeaders(testCase.transport_type, inboundHeader)

        // Generate outbound payloads
        const outboundTraceContextPayloads = testCase.outbound_payloads || []

        const insertCount = Math.max(outboundTraceContextPayloads.length)

        const outboundHeaders = []
        for (let i = 0; i < insertCount; i++) {
          const headers = {}
          transaction.insertDistributedTraceHeaders(headers)
          outboundHeaders.push(headers)
        }

        const insertedTraceContextTraces = outboundHeaders.map((headers) => {
          const tracestate = Tracestate.fromHeader({ header: headers.tracestate, agent })
          const intrinsics = tracestate.intrinsics

          // _parseIntrinsics returns null for absent items, remove them
          for (const k of Object.keys(intrinsics)) {
            if (intrinsics[k] === null) {
              delete intrinsics[k]
            }
          }

          // get payload for how we represent it internally to how tests want it
          const outboundPayload = {
            traceparent: Traceparent.fromHeader(headers.traceparent),
            tracestate
          }

          if (headers.newrelic) {
            const rawPayload = Buffer.from(headers.newrelic, 'base64').toString('utf-8')
            outboundPayload.newrelic = JSON.parse(rawPayload)
          }

          return outboundPayload
        })

        // end transaction
        transaction.trace.root.touch()
        transaction.end()

        // check `expected_priority_between`
        if (testCase.expected_priority_between) {
          const [minPriority, maxPriority] = testCase.expected_priority_between
          const actualPriority = transaction.priority
          assert.equal(typeof actualPriority, 'number')
          assert.ok(
            actualPriority >= minPriority && actualPriority <= maxPriority,
            `Expected transaction.priority (${actualPriority}) to be between ${minPriority} and ${maxPriority}`
          )
        }

        assertOutboundPayloads(testCase, insertedTraceContextTraces)
        assertEvents(testCase, agent)
        assertMetrics(testCase, agent)
      }

      assert.ok(transaction, 'we have a transaction')
    })

    end()
  })
}
