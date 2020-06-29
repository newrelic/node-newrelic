/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const nock = require('nock')
const sinon = require('sinon')
const helper = require('../lib/agent_helper')
const testCases = require('../lib/cross_agent_tests/response_code_handling.json')

const TEST_DOMAIN = 'test-collector.newrelic.com'
const TEST_COLLECTOR_URL = `https://${TEST_DOMAIN}`
const RUN_ID = 'runId'

const endpointDataChecks = {
  metric_data: function hasMetricData(agent) {
    return !!agent.metrics.getMetric('myMetric')
  },
  error_event_data: function hasErrorEventData(agent) {
    return (agent.errors.eventAggregator.events.length > 0)
  },
  error_data: function hasErrorData(agent) {
    return (agent.errors.traceAggregator.errors.length > 0)
  },
  analytic_event_data: function hasTransactionEventData(agent) {
    return (agent.transactionEventAggregator.length > 0)
  },
  transaction_sample_data: function hasTransactionTraceData(agent) {
    return !!agent.traces.trace
  },
  span_event_data: function hasSpanEventData(agent) {
    return (agent.spanEventAggregator.length > 0)
  },
  custom_event_data: function hasCustomEventData(agent) {
    // TODO... prob don't ned to grrab events
    return (agent.customEventAggregator.length > 0)
  },
  sql_trace_data: function hasSqlTraceData(agent) {
    return (agent.queries.samples.size > 0)
  }
}

tap.test('New Relic response code handling', (t) => {
  t.plan(testCases.length)

  testCases.forEach((testCase) => {
    const testName = `Status code: ${testCase.code}`
    t.test(testName, createStatusCodeTest(testCase))
  })
})

function createStatusCodeTest(testCase) {
  return (statusCodeTest) => {
    let startEndpoints = null
    let restartEndpoints = null
    let shutdown = null
    let testClock = null

    let disconnected = false
    let connecting = false

    let agent = null

    statusCodeTest.beforeEach((done) => {
      nock.disableNetConnect()

      testClock = sinon.useFakeTimers({
        toFake: ['setTimeout', 'setInterval', 'Date', 'clearInterval']
      })

      startEndpoints = setupConnectionEndpoints()
      disconnected = false
      connecting = false

      agent = helper.loadMockedAgent({
        license_key: 'license key here',
        apdex_t: Number.MIN_VALUE, // force transaction traces
        host: TEST_DOMAIN,
        plugins: {
          // turn off native metrics to avoid unwanted gc metrics
          native_metrics: {enabled: false}
        },
        distributed_tracing: {enabled: true},
        slow_sql: {enabled: true},
        transaction_tracer: {
          record_sql: 'obfuscated',
          explain_threshold: Number.MIN_VALUE // force SQL traces
        }
      })

      // We don't want any harvests before our manually triggered harvest
      agent.config.no_immediate_harvest = true

      createTestData(agent, () => {
        done()
      })
    })

    statusCodeTest.afterEach((done) => {
      helper.unloadAgent(agent)
      agent = null
      testClock.restore()
      testClock = null
      startEndpoints = null
      restartEndpoints = null
      shutdown = null

      if (!nock.isDone()) {
        console.error('Cleaning pending mocks: %j', nock.pendingMocks())
        nock.cleanAll()
      }

      nock.enableNetConnect()

      done()
    })

    // Test behavior for this status code against every endpoint
    // since not all business logic is shared for each.
    const endpointNames = Object.keys(endpointDataChecks)
    statusCodeTest.plan(endpointNames.length)

    endpointNames.forEach((endpointName) => {
      const checkHasTestData = endpointDataChecks[endpointName]
      const test = createReponseHandlingTest(endpointName, checkHasTestData)

      statusCodeTest.test(endpointName, test)
    })

    function createReponseHandlingTest(endpointName, checkHasTestData) {
      return (subTest) => {
        const mockEndpoint = nockRequest(endpointName, RUN_ID).reply(testCase.code)

        agent.start((error) => {
          verifyAgentStart(error)

          // Watch state changes once agent already started
          agent.on('disconnected', () => {
            disconnected = true
          })

          agent.on('connecting', () => {
            connecting = true
          })

          if (testCase.restart) {
            restartEndpoints = setupConnectionEndpoints()
          }

          if (testCase.disconnect) {
            shutdown = nockRequest('shutdown', RUN_ID).reply(200)
          }

          subTest.notOk(
            mockEndpoint.isDone(),
            `${endpointName} should not have been called yet. ` +
            'An early invocation may indicate a race condition with the test or agent.'
          )

          // Move clock forward to trigger auto harvests.
          testClock.tick(60000)

          whenAllAggregatorsSend(agent).then(() => {
            subTest.ok(mockEndpoint.isDone(), `called ${endpointName} endpoint`)

            verifyRunBehavior()
            verifyDataRetention()

            subTest.done()
          })
        })

        function verifyAgentStart(error) {
          if (error) {
            throw error
          }

          subTest.ok(startEndpoints.preconnect.isDone(), 'requested preconnect')
          subTest.ok(startEndpoints.connect.isDone(), 'requested connect')
          subTest.ok(startEndpoints.settings.isDone(), 'requested settings')
        }

        function verifyRunBehavior() {
          if (testCase.disconnect) {
            subTest.ok(disconnected, 'should have disconnected')
            subTest.notOk(connecting, 'should not have reconnected')

            subTest.ok(shutdown.isDone(), 'requested shutdown')
          } else if (testCase.restart) {
            subTest.ok(disconnected, 'should have disconnected')
            subTest.ok(connecting, 'should have started reconnecting')

            subTest.ok(restartEndpoints.preconnect.isDone(), 'requested preconnect')
            subTest.ok(restartEndpoints.connect.isDone(), 'requested connect')
            subTest.ok(restartEndpoints.settings.isDone(), 'requested settings')
          } else {
            subTest.notOk(disconnected, 'should not have disconnected')
            subTest.notOk(connecting, 'should not have reconnected')
          }
        }

        function verifyDataRetention() {
          const hasDataPostHarvest = checkHasTestData(agent)
          if (testCase.retain_data) {
            subTest.ok(
              hasDataPostHarvest,
              `should have retained data after ${endpointName} call`
            )
          } else {
            subTest.notOk(
              hasDataPostHarvest,
              `should not have retained data after ${endpointName} call`
            )
          }
        }
      }
    }
  }
}

function whenAllAggregatorsSend(agent) {
  const metricPromise = new Promise((resolve) => {
    agent.metrics.once(
      'finished metric_data data send.',
      function onMetricsFinished() {
        resolve()
      }
    )
  })
  
  const spanPromise = new Promise((resolve) => {
    agent.spanEventAggregator.once(
      'finished span_event_data data send.',
      function onSpansFinished() {
        resolve()
      }
    )
  })

  const customEventPromise = new Promise((resolve) => {
    agent.customEventAggregator.once(
      'finished custom_event_data data send.',
      function onCustomEventsFinished() {
        resolve()
      }
    )
  })

  const transactionEventPromise = new Promise((resolve) => {
    agent.transactionEventAggregator.once(
      'finished analytic_event_data data send.',
      function onTransactionEventsFinished() {
        resolve()
      }
    )
  })

  const transactionTracePromise = new Promise((resolve) => {
    agent.traces.once(
      'finished transaction_sample_data data send.',
      function onTracesFinished() {
        resolve()
      }
    )
  })

  const sqlTracePromise = new Promise((resolve) => {
    agent.queries.once(
      'finished sql_trace_data data send.',
      function onSqlTracesFinished() {
        resolve()
      }
    )
  })

  const errorTracePromise = new Promise((resolve) => {
    agent.errors.traceAggregator.once(
      'finished error_data data send.',
      function onErrorTracesFinished() {
        resolve()
      }
    )
  })

  const errorEventPromise = new Promise((resolve) => {
    agent.errors.eventAggregator.once(
      'finished error_event_data data send.',
      function onErrorEventsFinished() {
        resolve()
      }
    )
  })

  const promises = [
    metricPromise, 
    spanPromise, 
    customEventPromise, 
    transactionEventPromise, 
    transactionTracePromise, 
    sqlTracePromise, 
    errorTracePromise, 
    errorEventPromise
  ]

  return Promise.all(promises)
}

/**
 * Adds data to agent instance for use in endpoint tests.
 * Each type is added every test, even though not all endpoints are mocked.
 * This allows for verifying response handling for endpoint under test still
 * behaves correctly when other endpoints fail.
 * @param {*} agent The agent intance to add data to
 * @param {*} callback
 */
function createTestData(agent, callback) {
  const metric = agent.metrics.getOrCreateMetric(
    'myMetric'
  )
  metric.incrementCallCount()

  agent.errors.addUserError(null, new Error('Why?!!!?!!'))

  agent.customEventAggregator.add([{type: 'MyCustomEvent', timestamp: Date.now()}])

  helper.runInTransaction(agent, (transaction) => {
    const segment = transaction.trace.add("MySegment")
    segment.overwriteDurationInMillis(1)
    agent.queries.add(
      segment,
      'mysql',
      'select * from foo',
      new Error().stack
    )

    transaction.finalizeNameFromUri('/some/test/url', 200)
    transaction.end()
    callback()
  })
}

function setupConnectionEndpoints() {
  return {
    preconnect: nockRequest('preconnect').reply(200, {return_value: TEST_DOMAIN}),
    connect: nockRequest('connect').reply(200, {return_value: {agent_run_id: RUN_ID}}),
    settings: nockRequest('agent_settings', RUN_ID).reply(200, {return_value: []})
  }
}

function nockRequest(endpointMethod, runId) {
  const relativepath = helper.generateCollectorPath(endpointMethod, runId)
  return nock(TEST_COLLECTOR_URL).post(relativepath)
}
