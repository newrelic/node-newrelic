/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const nock = require('nock')
const sinon = require('sinon')
const helper = require('../lib/agent_helper')
const testCases = require('../lib/response_code_handling.json')
const {
  createTestData,
  endpointDataChecks,
  nockRequest,
  setupConnectionEndpoints,
  RUN_ID,
  TEST_DOMAIN,
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
        nock.disableNetConnect()

        const testClock = sinon.useFakeTimers({
          toFake: ['setTimeout', 'setInterval', 'Date', 'clearInterval']
        })

        const startEndpoints = setupConnectionEndpoints()
        const disconnected = false
        const connecting = false
        const started = false
        const agent = helper.loadMockedAgent({
          license_key: 'license key here',
          apdex_t: Number.MIN_VALUE, // force transaction traces
          host: TEST_DOMAIN,
          plugins: {
            // turn off native metrics to avoid unwanted gc metrics
            native_metrics: { enabled: false }
          },
          distributed_tracing: { enabled: true },
          slow_sql: { enabled: true },
          transaction_tracer: {
            record_sql: 'obfuscated',
            explain_threshold: Number.MIN_VALUE // force SQL traces
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
          connecting,
          disconnected,
          started,
          startEndpoints,
          testCase,
          testClock
        }
      })

      t.afterEach((ctx) => {
        const { agent, testClock } = ctx.nr
        helper.unloadAgent(agent)
        testClock.restore()
        if (!nock.isDone()) {
          // eslint-disable-next-line no-console
          console.error('Cleaning pending mocks: %j', nock.pendingMocks())
          nock.cleanAll()
        }

        nock.enableNetConnect()
      })

      // Test behavior for this status code against every endpoint
      // since not all business logic is shared for each.
      const endpointNames = Object.keys(endpointDataChecks)

      for (const endpointName of endpointNames) {
        const checkHasTestData = endpointDataChecks[endpointName]
        await t.test(endpointName, (t, end) => {
          const { agent, testCase, testClock } = t.nr
          const mockEndpoint = nockRequest(endpointName, RUN_ID).reply(testCase.code)

          agent.start(async (error) => {
            verifyAgentStart(t, error)

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
              t.nr.restartEndpoints = setupConnectionEndpoints()
            }

            if (testCase.disconnect) {
              t.nr.shutdown = nockRequest('shutdown', RUN_ID).reply(200)
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

            verifyRunBehavior(t)
            verifyDataRetention({ t, checkHasTestData, endpointName })
            end()
          })
        })
      }
    })
  }
})
