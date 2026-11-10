/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const Collector = require('../lib/test-collector')
const helper = require('../lib/agent_helper')
const testCases = require('../lib/response_code_handling.json')
const {
  createTestData,
  endpointDataChecks,
  jsonReply,
  createMockRequest,
  setupConnectionEndpoints,
  RUN_ID,
  waitUntilDone,
  whenAllAggregatorsSend,
  verifyAgentStart,
  verifyDataRetention,
  verifyRunBehavior
} = require('./response-handling-utils')

test('New Relic response code handling', async (t) => {
  for (const testCase of testCases) {
    const testName = `Status code: ${testCase.code}`
    await t.test(testName, async (t) => {
      t.beforeEach(async (ctx) => {
        const testClock = sinon.useFakeTimers({
          toFake: ['setTimeout', 'setInterval', 'Date', 'clearInterval']
        })

        const collector = new Collector({ runId: RUN_ID })
        await collector.listen()
        const mockRequest = createMockRequest(collector)
        const startEndpoints = setupConnectionEndpoints(mockRequest, collector, RUN_ID)
        const disconnected = false
        const connecting = false
        const started = false
        const agent = helper.loadMockedAgent({
          license_key: 'license key here',
          apdex_t: Number.MIN_VALUE, // force transaction traces
          ...collector.agentConfig,
          plugins: {
            // turn off native metrics to avoid unwanted gc metrics
            native_metrics: { enabled: false }
          },
          distributed_tracing: { enabled: true },
          slow_sql: { enabled: true },
          transaction_tracer: {
            record_sql: 'obfuscated',
            explain_threshold: Number.MIN_SAFE_INTEGER // force SQL traces
          },
          utilization: {
            detect_aws: false
          }
        })

        // We don't want any harvests before our manually triggered harvest
        agent.config.no_immediate_harvest = true

        await new Promise((resolve) => {
          createTestData(agent, resolve)
        })
        ctx.nr = {
          agent,
          collector,
          connecting,
          disconnected,
          mockRequest,
          started,
          startEndpoints,
          testCase,
          testClock
        }
      })

      t.afterEach((ctx) => {
        const { agent, collector, testClock } = ctx.nr
        helper.unloadAgent(agent)
        testClock.restore()
        const pending = collector.pendingHandlers()
        if (pending.length > 0) {
          console.error('Collector handlers never invoked: %j', pending)
        }
        collector.close()
      })

      // Test behavior for this status code against every endpoint
      // since not all business logic is shared for each.
      const endpointNames = Object.keys(endpointDataChecks)

      for (const endpointName of endpointNames) {
        const checkHasTestData = endpointDataChecks[endpointName]
        await t.test(endpointName, (t, end) => {
          const { agent, collector, mockRequest, testCase, testClock } = t.nr
          const mockEndpoint = mockRequest(endpointName, RUN_ID).reply(testCase.code, ...jsonReply({ return_value: null }))

          agent.start(async (error) => {
            await verifyAgentStart(t, error)

            // Watch state changes once agent already started
            agent.on('disconnected', () => {
              t.nr.disconnected = true
            })

            agent.on('connecting', () => {
              t.nr.connecting = true
            })

            agent.on('started', () => {
              t.nr.started = true
            })

            if (testCase.restart) {
              t.nr.restartEndpoints = setupConnectionEndpoints(mockRequest, collector, RUN_ID)
            }

            if (testCase.disconnect) {
              t.nr.shutdown = mockRequest('shutdown', RUN_ID).reply(200, ...jsonReply({ return_value: null }))
            }

            assert.ok(
              !mockEndpoint.isDone(),
              `${endpointName} should not have been called yet. ` +
                'An early invocation may indicate a race condition with the test or agent.'
            )

            // Move clock forward to trigger auto harvests.
            testClock.tick(60000)

            await whenAllAggregatorsSend(agent)
            assert.ok(mockEndpoint.isDone(), `called ${endpointName} endpoint`)

            if (testCase.restart) {
              // A restart's `agent_settings` report is fired from a
              // `config`-change listener and isn't awaited by anything --
              // `whenAllAggregatorsSend` only waits on data aggregators, not
              // this request. It reliably lands within a handful of event
              // loop turns.
              await waitUntilDone(t.nr.restartEndpoints.settings)
            }

            verifyRunBehavior(t)
            verifyDataRetention({ t, checkHasTestData, endpointName })
            end()
          })
        })
      }
    })
  }
})
