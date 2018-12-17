'use strict'

const tap = require('tap')
const nock = require('nock')
const path = require('path')
const fs = require('fs')
const helper = require('../lib/agent_helper')

const TEST_DOMAIN = 'test-collector.newrelic.com'
const TEST_COLLECTOR_URL = `https://${TEST_DOMAIN}`
const RUN_ID = 'runId'

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

    let preconnect
    let connect
    let settings

    let restartPreconnect
    let restartConnect
    let restartSettings

    let shutdown

    let agent

    t.beforeEach((done) => {
      nock.disableNetConnect()

      preconnect = nockRequest('preconnect')
        .reply(200, {return_value: TEST_DOMAIN})

      connect = nockRequest('connect')
        .reply(200, {return_value: {agent_run_id: RUN_ID}})

      settings = nockRequest('agent_settings', RUN_ID)
        .reply(200, {return_value: []})

      agent = helper.loadMockedAgent({
        license_key: 'license key here',
        apdex_t: 0.005,
        host: TEST_DOMAIN,
        feature_flag: {
          // turn off native metrics to avoid unwanted gc metrics
          native_metrics: false
        }
      })

      // We don't want any harvests before our manually triggered harvest
      agent.config.no_immediate_harvest = true
      agent._stopHarvester()

      done()
    })

    t.afterEach((done) => {
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

    testCases.forEach((testCase) => {
      const statusCode = testCase.code
      const testName = `Status code: ${statusCode}`

      t.test(testName, (subTest) => {
        const sendMetrics = nockRequest('metric_data', RUN_ID).reply(statusCode)

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

          const metric = agent.metrics.getOrCreateMetric(
            'myMetric'
          )
          metric.incrementCallCount()

          // add data for endpoint not mocked to ensure metric processing
          // still successful when another harvest step fails
          agent.errors.addUserError(null, new Error('Why?!!!?!!'))

          agent.harvest((error) => {
            if (error) {
              subTest.ok(error, 'should have nock error from error harvest step')

              const isErrorEndpoint = error.message.includes('method=error')
              subTest.ok(isErrorEndpoint, 'should be failure for error endpoint')
            }

            subTest.ok(sendMetrics.isDone(), 'sent metrics')

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

            const retrievedMetric = agent.metrics.getMetric('myMetric')
            if (testCase.retain_data) {
              subTest.ok(retrievedMetric, 'should still have custom metric')
            } else {
              subTest.notOk(retrievedMetric, 'should no longer have custom metric')
            }

            subTest.done()
          })
        })
      })
    })
  })
})

// TODO: update to p17
function nockRequest(endpointMethod, runId) {
  let relativepath = '/agent_listener/invoke_raw_method?' +
  `marshal_format=json&protocol_version=17&` +
  `license_key=license%20key%20here&method=${endpointMethod}`

  if (runId) {
    relativepath += `&run_id=${runId}`
  }

  return nock(TEST_COLLECTOR_URL).post(relativepath)
}
