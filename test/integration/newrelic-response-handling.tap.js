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
    return (agent.errors.getEvents().length > 0)
  },
  error_data: function hasErrorData(agent) {
    return (agent.errors.getErrors().length > 0)
  },
  analytic_event_data: function hasTransactionEventData(agent) {
    return (agent.events.length > 0)
  },
  transaction_sample_data: function hasTransactionTraceData(agent) {
    return !!agent.traces.trace
  },
  span_event_data: function hasSpanEventData(agent) {
    return (agent.spans.length > 0)
  },
  custom_event_data: function hasCustomEventData(agent) {
    return (agent.customEvents.length > 0)
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

    let disconnected = false
    let connecting = false

    let agent = null

    statusCodeTest.beforeEach((done) => {
      nock.disableNetConnect()

      startEndpoints = setupConnectionEndpoints()
      disconnected = false
      connecting = false

      agent = helper.loadMockedAgent({
        license_key: 'license key here',
        apdex_t: Number.MIN_VALUE, // force transaction traces
        host: TEST_DOMAIN,
        feature_flag: {
          // turn off native metrics to avoid unwanted gc metrics
          native_metrics: false
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
          // Clear agent start scheduled harvest to only allow manually triggered harvest
          agent._stopHarvester()

          const scheduleHarvestSpy = sinon.spy(agent, '_scheduleHarvester')

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

          agent.harvest((error) => {
            // A successful harvest will schedule a new one. While unlikely, this
            // could result in modifying agent data before the test is done.
            agent._stopHarvester()

            verifyHarvestErrorExpected(error)

            subTest.ok(mockEndpoint.isDone(), `called ${endpointName} endpoint`)

            verifyRunBehavior()

            verifyDataRetention()

            verifyNewHarvestScheduled(scheduleHarvestSpy)

            subTest.done()
          })
        })

        function verifyNewHarvestScheduled(scheduleHarvestSpy) {
          // disconnect case should not schedule a harvest
          const expectedHarvests = testCase.disconnect ? 0 : 1
          const actualHarvests = scheduleHarvestSpy.callCount

          tap.equal(actualHarvests, expectedHarvests, 'wrong # harvests scheduled')
        }

        function verifyAgentStart(error) {
          if (error) {
            throw error
          }

          subTest.ok(startEndpoints.preconnect.isDone(), 'requested preconnect')
          subTest.ok(startEndpoints.connect.isDone(), 'requested connect')
          subTest.ok(startEndpoints.settings.isDone(), 'requested settings')
        }

        function verifyHarvestErrorExpected(error) {
          subTest.ok(error, 'should have error from other harvest endpoints')

          subTest.match(
            error.message,
            /Nock: No match for request/,
            'should be nock error'
          )

          const isEndpointUnderTest = error.message.includes(`method=${endpointName}`)
          subTest.notOk(isEndpointUnderTest, 'should not fail for endpoint under test')
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

  agent.customEvents.add([{type: 'MyCustomEvent', timestamp: Date.now()}])

  helper.runInTransaction(agent, (transaction) => {
    const segment = transaction.trace.add("MySegment")
    segment.overwriteDurationInMillis(1)
    agent.queries.addQuery(
      segment,
      'mysql',
      'select * from foo',
      new Error().stack
    )

    transaction.finalizeNameFromUri('/some/test/url', 200)
    transaction.end(() => {
      callback()
    })
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
