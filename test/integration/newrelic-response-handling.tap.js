'use strict'

const tap = require('tap')
const nock = require('nock')
const path = require('path')
const fs = require('fs')
const helper = require('../lib/agent_helper')

const TEST_DOMAIN = 'test-collector.newrelic.com'
const TEST_COLLECTOR_URL = `https://${TEST_DOMAIN}`
const RUN_ID = 'runId'
const PROTOCOL_VERSION = 17

tap.test('NewRelic server response code handling', (t) => {
  const crossAgentTestFile = path.resolve(
    __dirname,
    '../lib/cross_agent_tests/',
    'response_code_handling.json'
  )

  fs.readFile(crossAgentTestFile, function(err, data) {
    if (err) {
      throw err
    }

    const testCases = JSON.parse(data)

    t.autoend()
    t.plan(testCases.length)

    testCases.forEach((testCase) => {
      const statusCode = testCase.code
      const testName = `Status code: ${statusCode}`

      t.test(testName, (statusCodeTest) => {
        let preconnect
        let connect
        let settings

        let restartPreconnect
        let restartConnect
        let restartSettings

        let shutdown

        let agent

        statusCodeTest.beforeEach((done) => {
          nock.disableNetConnect()

          preconnect = nockRequest('preconnect')
            .reply(200, {return_value: TEST_DOMAIN})

          connect = nockRequest('connect')
            .reply(200, {return_value: {agent_run_id: RUN_ID}})

          settings = nockRequest('agent_settings', RUN_ID)
            .reply(200, {return_value: []})

          agent = helper.loadMockedAgent({
            license_key: 'license key here',
            apdex_t: Number.MIN_VALUE,
            host: TEST_DOMAIN,
            feature_flag: {
              // turn off native metrics to avoid unwanted gc metrics
              native_metrics: false
            },
            distributed_tracing: {enabled: true}
          })

          // We don't want any harvests before our manually triggered harvest
          agent.config.no_immediate_harvest = true
          agent._stopHarvester()

          createTestData(agent, () => {
            done()
          })
        })

        statusCodeTest.afterEach((done) => {
          if (agent.isRunning) { // this is bullshit, figure out realness
            agent.stop()
          }

          helper.unloadAgent(agent)

          if (!nock.isDone()) {
            console.error('Cleaning pending mocks: %j', nock.pendingMocks())
            nock.cleanAll()
          }

          agent = null

          preconnect = null
          connect = null
          settings = null

          restartPreconnect = null
          restartConnect = null
          restartSettings = null

          shutdown = null

          nock.enableNetConnect()

          done()
        })


        statusCodeTest.autoend()
        statusCodeTest.plan(7)


        statusCodeTest.test('metric_data', createReponseHandlingTest(
          'metric_data',
          function hasMetricData() {
            return !!agent.metrics.getMetric('myMetric')
          }
        ))

        statusCodeTest.test('error_event_data', createReponseHandlingTest(
          'error_event_data',
          function hasErrorEventData() {
            return (agent.errors.getEvents().length > 0)
          }
        ))

        statusCodeTest.test('error_data', createReponseHandlingTest(
          'error_data',
          function hasErrorData() {
            return (agent.errors.getErrors().length > 0)
          }
        ))

        statusCodeTest.test('analytic_event_data', createReponseHandlingTest(
          'analytic_event_data',
          function hasTransactionEventData() {
            return (agent.events.length > 0)
          }
        ))

        statusCodeTest.test('transaction_sample_data', createReponseHandlingTest(
          'transaction_sample_data',
          function hasTransactionTraceData() {
            return !!agent.traces.trace
          }
        ))

        statusCodeTest.test('span_event_data', createReponseHandlingTest(
          'span_event_data',
          function hasSpanEventData() {
            return (agent.spans.length > 0)
          }
        ))

        statusCodeTest.test('custom_event_data', createReponseHandlingTest(
          'custom_event_data',
          function hasCustomEventData() {
            return (agent.customEvents.length > 0)
          }
        ))

        function createReponseHandlingTest(endpointName, hasTestData) {
          return (subTest) => {
            const mockEndpoint = nockRequest(endpointName, RUN_ID).reply(statusCode)

            agent.start((error) => {
              if (error) {
                throw error
              }

              let disconnected = false
              agent.on('disconnected', () => {
                disconnected = true
              })

              let connecting = false
              agent.on('connecting', () => {
                connecting = true
              })

              subTest.ok(preconnect.isDone(), 'requested preconnect')
              subTest.ok(connect.isDone(), 'requested connect')
              subTest.ok(settings.isDone(), 'requested settings')


              if (testCase.restart) {
                restartPreconnect = nockRequest('preconnect')
                  .reply(200, {return_value: TEST_DOMAIN})

                restartConnect = nockRequest('connect')
                  .reply(200, {return_value: {agent_run_id: RUN_ID}})

                restartSettings = nockRequest('agent_settings', RUN_ID)
                  .reply(200, {return_value: []})
              }

              if (testCase.disconnect) {
                shutdown = nockRequest('shutdown', RUN_ID).reply(200)
              }

              agent.harvest((error) => {
                if (testCase.restart || testCase.disconnect) {
                  subTest.notOk(error, 'restart and disconnect overrule errors')
                } else {
                  subTest.ok(error, 'should have error from other harvest endpoints')

                  const isNockError = error.message.includes('Nock: No match for request')
                  if (!isNockError) {
                    console.error(error)
                  }
                  subTest.ok(isNockError, 'should be nock specific error')

                  const isEndpointUnderTest = error.message.includes(`method=${endpointName}`)
                  subTest.notOk(isEndpointUnderTest, 'should not fail for endpoint under test')
                }

                subTest.ok(mockEndpoint.isDone(), `called ${endpointName} endpoint`)

                if (testCase.disconnect) {
                  subTest.ok(disconnected, 'should have disconnected')
                  subTest.notOk(connecting, 'should not have reconnected')

                  subTest.ok(shutdown, 'requested shutdown')
                } else if (testCase.restart) {
                  subTest.ok(disconnected, 'should have disconnected')
                  subTest.ok(connecting, 'should have started reconnecting')

                  subTest.ok(restartPreconnect.isDone(), 'requested preconnect')
                  subTest.ok(restartConnect.isDone(), 'requested connect')
                  subTest.ok(restartSettings.isDone(), 'requested settings')
                } else {
                  subTest.notOk(disconnected, 'should not have disconnected')
                  subTest.notOk(connecting, 'should not have reconnected')
                }

                const hasDataPostHarvest = hasTestData()
                if (testCase.retain_data) {
                  subTest.ok(hasDataPostHarvest, `should have retained data after ${endpointName} call`)
                } else {
                  subTest.notOk(hasDataPostHarvest, `should not have retained data after ${endpointName} call`)
                }

                subTest.done()
              })
            })
          }
        }
      })
    })
  })
})

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
    transaction.trace.add("MySegment")
    transaction.finalizeNameFromUri('/some/test/url', 200)
    transaction.end(() => {
      callback()
    })
  })
}

// TODO use agent_helper
function nockRequest(endpointMethod, runId) {
  let relativepath = '/agent_listener/invoke_raw_method?' +
  `marshal_format=json&protocol_version=${PROTOCOL_VERSION}&` +
  `license_key=license%20key%20here&method=${endpointMethod}`

  if (runId) {
    relativepath += `&run_id=${runId}`
  }

  return nock(TEST_COLLECTOR_URL).post(relativepath)
}
