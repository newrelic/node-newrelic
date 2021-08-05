/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const nock = require('nock')
const helper = require('../../lib/agent_helper')
const CollectorApi = require('../../../lib/collector/api')

const HOST = 'collector.newrelic.com'
const PORT = 443
const URL = 'https://' + HOST
const RUN_ID = 1337

tap.test('reportSettings', (t) => {
  t.autoend()

  let agent = null
  let collectorApi = null

  let settings = null

  const emptySettingsPayload = {
    return_value: []
  }

  t.beforeEach(() => {
    agent = setupMockedAgent()
    agent.config.run_id = RUN_ID
    collectorApi = new CollectorApi(agent)

    nock.disableNetConnect()

    settings = nock(URL)
      .post(helper.generateCollectorPath('agent_settings', RUN_ID))
      .reply(200, emptySettingsPayload)
  })

  t.afterEach(() => {
    if (!nock.isDone()) {
      /* eslint-disable no-console */
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      /* eslint-enable no-console */
      nock.cleanAll()
    }

    nock.enableNetConnect()

    helper.unloadAgent(agent)
    agent = null
    collectorApi = null
  })

  t.test('should not error out', (t) => {
    collectorApi.reportSettings((error) => {
      t.error(error)

      settings.done()

      t.end()
    })
  })

  t.test('should return the expected `empty` response', (t) => {
    collectorApi.reportSettings((error, res) => {
      t.same(res.payload, emptySettingsPayload.return_value)

      settings.done()

      t.end()
    })
  })
})

tap.test('error_data', (t) => {
  t.autoend()

  t.test('requires errors to send', (t) => {
    const agent = setupMockedAgent()
    const collectorApi = new CollectorApi(agent)

    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    collectorApi.error_data(null, (err) => {
      t.ok(err)
      t.equal(err.message, 'must pass errors to send')

      t.end()
    })
  })

  t.test('requires a callback', (t) => {
    const agent = setupMockedAgent()
    const collectorApi = new CollectorApi(agent)

    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    t.throws(() => {
      collectorApi.error_data([], null)
    }, new Error('callback is required'))
    t.end()
  })

  t.test('receiving 200 response, with valid data', (t) => {
    t.autoend()

    let agent = null
    let collectorApi = null

    let errorDataEndpoint = null

    const errors = [
      [
        0, // timestamp, which is always ignored
        'TestTransaction/Uri/TEST', // transaction name
        'You done screwed up', // helpful, informative message
        'SampleError', // Error type (almost always Error in practice)
        {} // request parameters
      ]
    ]

    t.beforeEach(() => {
      agent = setupMockedAgent()
      agent.config.run_id = RUN_ID
      collectorApi = new CollectorApi(agent)

      nock.disableNetConnect()

      const response = { return_value: [] }

      errorDataEndpoint = nock(URL)
        .post(helper.generateCollectorPath('error_data', RUN_ID))
        .reply(200, response)
    })

    t.afterEach(() => {
      if (!nock.isDone()) {
        /* eslint-disable no-console */
        console.error('Cleaning pending mocks: %j', nock.pendingMocks())
        /* eslint-enable no-console */
        nock.cleanAll()
      }

      nock.enableNetConnect()

      helper.unloadAgent(agent)
      agent = null
      collectorApi = null
    })

    t.test('should not error out', (t) => {
      collectorApi.error_data(errors, (error) => {
        t.error(error)

        errorDataEndpoint.done()

        t.end()
      })
    })

    t.test('should return retain state', (t) => {
      collectorApi.error_data(errors, (error, res) => {
        const command = res

        t.equal(command.retainData, false)

        errorDataEndpoint.done()

        t.end()
      })
    })
  })
})

tap.test('sql_trace_data', (t) => {
  t.autoend()

  t.test('requires queries to send', (t) => {
    const agent = setupMockedAgent()
    const collectorApi = new CollectorApi(agent)

    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    collectorApi.sql_trace_data(null, (err) => {
      t.ok(err)
      t.equal(err.message, 'must pass queries to send')

      t.end()
    })
  })

  t.test('requires a callback', (t) => {
    const agent = setupMockedAgent()
    const collectorApi = new CollectorApi(agent)

    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    t.throws(() => {
      collectorApi.sql_trace_data([], null)
    }, new Error('callback is required'))
    t.end()
  })

  t.test('receiving 200 response, with valid data', (t) => {
    t.autoend()

    let agent = null
    let collectorApi = null

    let sqlTraceEndpoint = null

    const queries = [
      [
        'TestTransaction/Uri/TEST',
        '/TEST',
        1234,
        'select * from foo',
        '/Datastore/Mysql/select/foo',
        1,
        700,
        700,
        700,
        'compressed/bas64 params'
      ]
    ]

    t.beforeEach(() => {
      agent = setupMockedAgent()
      agent.config.run_id = RUN_ID
      collectorApi = new CollectorApi(agent)

      nock.disableNetConnect()

      const response = { return_value: [] }

      sqlTraceEndpoint = nock(URL)
        .post(helper.generateCollectorPath('sql_trace_data', RUN_ID))
        .reply(200, response)
    })

    t.afterEach(() => {
      if (!nock.isDone()) {
        /* eslint-disable no-console */
        console.error('Cleaning pending mocks: %j', nock.pendingMocks())
        /* eslint-enable no-console */
        nock.cleanAll()
      }

      nock.enableNetConnect()

      helper.unloadAgent(agent)
      agent = null
      collectorApi = null
    })

    t.test('should not error out', (t) => {
      collectorApi.sql_trace_data(queries, (error) => {
        t.error(error)

        sqlTraceEndpoint.done()

        t.end()
      })
    })

    t.test('should return retain state', (t) => {
      collectorApi.sql_trace_data(queries, (error, res) => {
        const command = res

        t.equal(command.retainData, false)

        sqlTraceEndpoint.done()

        t.end()
      })
    })
  })
})

tap.test('analytic_event_data (transaction events)', (t) => {
  t.autoend()

  t.test('requires events to send', (t) => {
    const agent = setupMockedAgent()
    const collectorApi = new CollectorApi(agent)

    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    collectorApi.analytic_event_data(null, (err) => {
      t.ok(err)
      t.equal(err.message, 'must pass events to send')

      t.end()
    })
  })

  t.test('requires a callback', (t) => {
    const agent = setupMockedAgent()
    const collectorApi = new CollectorApi(agent)

    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    t.throws(() => {
      collectorApi.analytic_event_data([], null)
    }, new Error('callback is required'))

    t.end()
  })

  t.test('receiving 200 response, with valid data', (t) => {
    t.autoend()

    let agent = null
    let collectorApi = null

    let analyticEventEndpoint = null

    const transactionEvents = [
      RUN_ID,
      [
        {
          webDuration: 1.0,
          timestamp: 1000,
          name: 'Controller/rails/welcome/index',
          duration: 1.0,
          type: 'Transaction'
        },
        {
          A: 'a',
          B: 'b'
        }
      ]
    ]

    t.beforeEach(() => {
      agent = setupMockedAgent()
      agent.config.run_id = RUN_ID
      collectorApi = new CollectorApi(agent)

      nock.disableNetConnect()

      const response = { return_value: [] }

      analyticEventEndpoint = nock(URL)
        .post(helper.generateCollectorPath('analytic_event_data', RUN_ID))
        .reply(200, response)
    })

    t.afterEach(() => {
      if (!nock.isDone()) {
        /* eslint-disable no-console */
        console.error('Cleaning pending mocks: %j', nock.pendingMocks())
        /* eslint-enable no-console */
        nock.cleanAll()
      }

      nock.enableNetConnect()

      helper.unloadAgent(agent)
      agent = null
      collectorApi = null
    })

    t.test('should not error out', (t) => {
      collectorApi.analytic_event_data(transactionEvents, (error) => {
        t.error(error)

        analyticEventEndpoint.done()

        t.end()
      })
    })

    t.test('should return retain state', (t) => {
      collectorApi.analytic_event_data(transactionEvents, (error, res) => {
        const command = res

        t.equal(command.retainData, false)

        analyticEventEndpoint.done()

        t.end()
      })
    })
  })
})

tap.test('metric_data', (t) => {
  t.autoend()

  t.test('requires metrics to send', (t) => {
    const agent = setupMockedAgent()
    const collectorApi = new CollectorApi(agent)

    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    collectorApi.metric_data(null, (err) => {
      t.ok(err)
      t.equal(err.message, 'must pass metrics to send')

      t.end()
    })
  })

  t.test('requires a callback', (t) => {
    const agent = setupMockedAgent()
    const collectorApi = new CollectorApi(agent)

    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    t.throws(() => {
      collectorApi.metric_data([], null)
    }, new Error('callback is required'))

    t.end()
  })

  t.test('receiving 200 response, with valid data', (t) => {
    t.autoend()

    let agent = null
    let collectorApi = null

    let metricsEndpoint = null

    const metrics = {
      toJSON: function () {
        return [
          [{ name: 'Test/Parent' }, [1, 0.026, 0.006, 0.026, 0.026, 0.000676]],
          [{ name: 'Test/Child/1' }, [1, 0.012, 0.012, 0.012, 0.012, 0.000144]],
          [{ name: 'Test/Child/2' }, [1, 0.008, 0.008, 0.008, 0.008, 0.000064]]
        ]
      }
    }

    t.beforeEach(() => {
      agent = setupMockedAgent()
      agent.config.run_id = RUN_ID
      collectorApi = new CollectorApi(agent)

      nock.disableNetConnect()

      const response = { return_value: [] }

      metricsEndpoint = nock(URL)
        .post(helper.generateCollectorPath('metric_data', RUN_ID))
        .reply(200, response)
    })

    t.afterEach(() => {
      if (!nock.isDone()) {
        /* eslint-disable no-console */
        console.error('Cleaning pending mocks: %j', nock.pendingMocks())
        /* eslint-enable no-console */
        nock.cleanAll()
      }

      nock.enableNetConnect()

      helper.unloadAgent(agent)
      agent = null
      collectorApi = null
    })

    t.test('should not error out', (t) => {
      collectorApi.metric_data(metrics, (error) => {
        t.error(error)

        metricsEndpoint.done()

        t.end()
      })
    })

    t.test('should return retain state', (t) => {
      collectorApi.metric_data(metrics, (error, res) => {
        const command = res

        t.equal(command.retainData, false)

        metricsEndpoint.done()

        t.end()
      })
    })
  })
})

tap.test('transaction_sample_data (transaction trace)', (t) => {
  t.autoend()

  t.test('requires slow trace data to send', (t) => {
    const agent = setupMockedAgent()
    const collectorApi = new CollectorApi(agent)

    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    collectorApi.transaction_sample_data(null, (err) => {
      t.ok(err)
      t.equal(err.message, 'must pass traces to send')

      t.end()
    })
  })

  t.test('requires a callback', (t) => {
    const agent = setupMockedAgent()
    const collectorApi = new CollectorApi(agent)

    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    t.throws(() => {
      collectorApi.transaction_sample_data([], null)
    }, new Error('callback is required'))

    t.end()
  })

  t.test('receiving 200 response, with valid data', (t) => {
    t.autoend()

    let agent = null
    let collectorApi = null

    let transactionTraceEndpoint = null

    // imagine this is a serialized transaction trace
    const trace = []

    t.beforeEach(() => {
      agent = setupMockedAgent()
      agent.config.run_id = RUN_ID
      collectorApi = new CollectorApi(agent)

      nock.disableNetConnect()

      const response = { return_value: [] }

      transactionTraceEndpoint = nock(URL)
        .post(helper.generateCollectorPath('transaction_sample_data', RUN_ID))
        .reply(200, response)
    })

    t.afterEach(() => {
      if (!nock.isDone()) {
        /* eslint-disable no-console */
        console.error('Cleaning pending mocks: %j', nock.pendingMocks())
        /* eslint-enable no-console */
        nock.cleanAll()
      }

      nock.enableNetConnect()

      helper.unloadAgent(agent)
      agent = null
      collectorApi = null
    })

    t.test('should not error out', (t) => {
      collectorApi.transaction_sample_data(trace, (error) => {
        t.error(error)

        transactionTraceEndpoint.done()

        t.end()
      })
    })

    t.test('should return retain state', (t) => {
      collectorApi.transaction_sample_data(trace, (error, res) => {
        const command = res

        t.equal(command.retainData, false)

        transactionTraceEndpoint.done()

        t.end()
      })
    })
  })
})

tap.test('shutdown', (t) => {
  t.autoend()

  t.test('requires a callback', (t) => {
    const agent = setupMockedAgent()
    const collectorApi = new CollectorApi(agent)

    t.teardown(() => {
      helper.unloadAgent(agent)
    })

    t.throws(() => {
      collectorApi.shutdown(null)
    }, new Error('callback is required'))

    t.end()
  })

  t.test('receiving 200 response, with valid data', (t) => {
    t.autoend()

    let agent = null
    let collectorApi = null

    let shutdownEndpoint = null

    t.beforeEach(() => {
      agent = setupMockedAgent()
      agent.config.run_id = RUN_ID
      collectorApi = new CollectorApi(agent)

      nock.disableNetConnect()

      const response = { return_value: null }

      shutdownEndpoint = nock(URL)
        .post(helper.generateCollectorPath('shutdown', RUN_ID))
        .reply(200, response)
    })

    t.afterEach(() => {
      if (!nock.isDone()) {
        /* eslint-disable no-console */
        console.error('Cleaning pending mocks: %j', nock.pendingMocks())
        /* eslint-enable no-console */
        nock.cleanAll()
      }

      nock.enableNetConnect()

      helper.unloadAgent(agent)
      agent = null
      collectorApi = null
    })

    t.test('should not error out', (t) => {
      collectorApi.shutdown((error) => {
        t.error(error)

        shutdownEndpoint.done()

        t.end()
      })
    })

    t.test('should return null', (t) => {
      collectorApi.shutdown((error, res) => {
        t.equal(res.payload, null)

        shutdownEndpoint.done()

        t.end()
      })
    })
  })

  t.test('fail on a 503 status code', (t) => {
    t.autoend()

    let agent = null
    let collectorApi = null

    let shutdownEndpoint = null

    t.beforeEach(() => {
      agent = setupMockedAgent()
      agent.config.run_id = RUN_ID
      collectorApi = new CollectorApi(agent)

      nock.disableNetConnect()

      shutdownEndpoint = nock(URL).post(helper.generateCollectorPath('shutdown', RUN_ID)).reply(503)
    })

    t.afterEach(() => {
      if (!nock.isDone()) {
        /* eslint-disable no-console */
        console.error('Cleaning pending mocks: %j', nock.pendingMocks())
        /* eslint-enable no-console */
        nock.cleanAll()
      }

      nock.enableNetConnect()

      helper.unloadAgent(agent)
      agent = null
      collectorApi = null
    })

    t.test('should not error out', (t) => {
      collectorApi.shutdown((error) => {
        t.error(error)

        shutdownEndpoint.done()

        t.end()
      })
    })

    t.test('should no longer have agent run id', (t) => {
      collectorApi.shutdown(() => {
        t.notOk(agent.config.run_id)

        shutdownEndpoint.done()

        t.end()
      })
    })

    t.test('should tell the requester to shut down', (t) => {
      collectorApi.shutdown((error, res) => {
        const command = res
        t.equal(command.shouldShutdownRun(), true)

        shutdownEndpoint.done()

        t.end()
      })
    })
  })
})

function setupMockedAgent() {
  const agent = helper.loadMockedAgent({
    host: HOST,
    port: PORT,
    app_name: ['TEST'],
    ssl: true,
    license_key: 'license key here',
    utilization: {
      detect_aws: false,
      detect_pcf: false,
      detect_azure: false,
      detect_gcp: false,
      detect_docker: false
    },
    browser_monitoring: {},
    transaction_tracer: {}
  })
  agent.reconfigure = function () {}
  agent.setState = function () {}

  return agent
}
