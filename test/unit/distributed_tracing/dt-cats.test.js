/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const Exception = require('../../../lib/errors').Exception
const helper = require('../../lib/agent_helper')
const recorder = require('../../../lib/metrics/recorders/distributed-trace')
// recordSupportability is stubbed out on the test agent. Since
// supportability metrics are expected in the tests we unstub it.
const recordSupportability = require('../../../lib/agent').prototype.recordSupportability

const testCases = require('../../lib/cross_agent_tests/distributed_tracing/distributed_tracing.json')

test('distributed tracing', async function (t) {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent({ distributed_tracing: { enabled: true } })
    agent.recordSupportability = recordSupportability
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  for (const testCase of testCases) {
    await t.test(testCase.test_name, (ctx, end) => {
      const { agent } = ctx.nr
      agent.config.trusted_account_key = testCase.trusted_account_key
      agent.config.distributed_tracing.account_id = testCase.account_id
      agent.config.primary_application_id = 'test app'
      agent.config.span_events.enabled = testCase.span_events_enabled
      helper.runInTransaction(agent, (tx) => {
        tx.type = testCase.web_transaction ? 'web' : 'bg'
        tx.baseSegment = tx.trace.add('MyBaseSegment', (segment) => {
          recorder(
            tx,
            testCase.web_transaction ? 'Web' : 'Other',
            segment.getDurationInMillis(),
            segment.getExclusiveDurationInMillis()
          )
        })
        agent.tracer.setSegment({ segment: tx.baseSegment })

        if (!Array.isArray(testCase.inbound_payloads)) {
          testCase.inbound_payloads = [testCase.inbound_payloads]
        }
        testCase.inbound_payloads.forEach((payload) => {
          const headers = { newrelic: '' }
          if (payload) {
            headers.newrelic = JSON.stringify(payload)
          }
          tx.acceptDistributedTraceHeaders(testCase.transport_type, headers)
          if (testCase.intrinsics.target_events.indexOf('TransactionError') > -1) {
            const error = new Error('uh oh')
            const exception = new Exception({ error })
            tx.addException(exception)
          }
        })

        if (testCase.outbound_payloads) {
          testCase.outbound_payloads.forEach((outbound) => {
            const headers = {}
            tx.insertDistributedTraceHeaders(headers)
            const payload = headers.newrelic
            const created = tx._getParsedPayload(payload)
            const exact = outbound.exact
            const keyRegex = /^d\.(.{2})$/
            Object.keys(exact).forEach((key) => {
              const match = keyRegex.exec(key)
              if (match) {
                assert.equal(created.d[match[1]], exact[key])
              } else {
                assert.deepStrictEqual(created.v, exact.v)
              }
            })

            if (outbound.expected) {
              outbound.expected.forEach((key) => {
                assert.ok(Object.prototype.hasOwnProperty.call(created.d, keyRegex.exec(key)[1]))
              })
            }

            if (outbound.unexpected) {
              outbound.unexpected.forEach((key) => {
                assert.ok(!Object.prototype.hasOwnProperty.call(created.d, keyRegex.exec(key)[1]))
              })
            }
          })
        }

        tx.trace.root.touch()
        tx.end()
        const intrinsics = testCase.intrinsics
        intrinsics.target_events.forEach((type) => {
          assert.ok(['Transaction', 'TransactionError', 'Span'].includes(type))

          const common = intrinsics.common
          const specific = intrinsics[type] || {}
          let toCheck
          switch (type) {
            case 'Transaction':
              toCheck = agent.transactionEventAggregator.getEvents()
              break
            case 'TransactionError':
              toCheck = agent.errors.eventAggregator.getEvents()
              break
            case 'Span':
              toCheck = agent.spanEventAggregator.getEvents()
              break
          }
          const exact = Object.assign(specific.exact || {}, common.exact || {})

          const arbitrary = (specific.expected || []).concat(common.expected || [])
          const unexpected = (specific.unexpected || []).concat(common.unexpected || [])

          assert.ok(toCheck.length > 0)
          toCheck.forEach((event) => {
            // Span events are not payload-formatted straight out of the
            // aggregator.
            if (typeof event.toJSON === 'function') {
              event = event.toJSON()
            }

            const attributes = event[0]
            arbitrary.forEach((key) => {
              assert.ok(attributes[`${key}`], `${type} should have ${key}`)
            })
            unexpected.forEach((key) => {
              assert.ok(!attributes[`${key}`], `${type} should not have ${key}`)
            })
            Object.keys(exact).forEach((key) => {
              assert.equal(attributes[key], exact[key], `${type} should have equal ${key}`)
            })
          })
        })

        const metrics = agent.metrics
        testCase.expected_metrics.forEach((metricPair) => {
          const metricName = metricPair[0]
          const callCount = metrics.getOrCreateMetric(metricName).callCount
          const metricCount = metricPair[1]
          assert.equal(callCount, metricCount, `${metricName} should have ${metricCount} samples`)
        })
        end()
      })
    })
  }
})
