/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const nock = require('nock')
const crypto = require('crypto')
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

  t.test('handles excessive payload sizes without blocking subsequent sends', (t) => {
    // remove the nock to agent_settings from beforeEach to avoid a console.error on afterEach
    nock.cleanAll()
    const tstamp = 1_707_756_300_000 // 2024-02-12T11:45:00.000-05:00
    function log(data) {
      return JSON.stringify({
        level: 30,
        time: tstamp,
        pid: 17035,
        hostname: 'test-host',
        msg: data
      })
    }

    const kb512 = log(crypto.randomBytes(524_288).toString('base64'))
    const mb1 = log(crypto.randomBytes(1_048_576).toString('base64'))
    const toFind = log('find me')

    let sends = 0
    const ncontext = nock(URL)
      .post(helper.generateCollectorPath('log_event_data', RUN_ID))
      .times(2)
      .reply(200)

    agent.logs.on('finished log_event_data data send.', () => {
      sends += 1
      if (sends === 3) {
        t.equal(ncontext.isDone(), true)
        t.end()
      }
    })

    agent.logs.add(kb512)
    agent.logs.send()
    agent.logs.add(mb1)
    agent.logs.send()
    agent.logs.add(toFind)
    agent.logs.send()
  })
})

/**
 * This array contains the data necessary to test the individual collector endpoints
 * you must provide:
 *  - `key`: name of method/collector endpoint to test
 *  - `errorMsg`: substring when missing data
 *  - `data`: sample data of relevant method/collector endpoint
 */
const apiMethods = [
  {
    key: 'error_data',
    data: [
      [
        0, // timestamp, which is always ignored
        'TestTransaction/Uri/TEST', // transaction name
        'You done screwed up', // helpful, informative message
        'SampleError', // Error type (almost always Error in practice)
        {} // request parameters
      ]
    ]
  },
  {
    key: 'error_event_data',
    data: [
      [
        {
          'error.expected': false,
          'traceId': '2714fa36883e18f6',
          'error.class': 'I am an error',
          'type': 'TransactionError',
          'transactionName': 'OtherTransaction/Custom/Simple/sqlTransaction',
          'priority': 1.205386,
          'duration': 0.001,
          'nr.transactionGuid': '2714fa36883e18f6',
          'port': 8080,
          'error.message': 'I am an error',
          'guid': '2714fa36883e18f6',
          'nr.tripId': '2714fa36883e18f6',
          'sampled': true,
          'timestamp': '1543864407859'
        },
        {
          test: 'metric'
        }
      ]
    ]
  },
  {
    key: 'sql_trace_data',
    data: [
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
  },
  {
    key: 'analytic_event_data',
    data: [
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
  },
  {
    key: 'metric_data',
    data: {
      toJSON: function () {
        return [
          [{ name: 'Test/Parent' }, [1, 0.026, 0.006, 0.026, 0.026, 0.000676]],
          [{ name: 'Test/Child/1' }, [1, 0.012, 0.012, 0.012, 0.012, 0.000144]],
          [{ name: 'Test/Child/2' }, [1, 0.008, 0.008, 0.008, 0.008, 0.000064]]
        ]
      }
    }
  },
  {
    key: 'transaction_sample_data',
    data: [
      [
        1543864412869,
        0,
        'OtherTransaction/Custom/Simple/sqlTransaction',
        'Custom/Simple/sqlTransaction',
        `[1543864412869,{},{},[0,1,'ROOT',{'async_context':'main','exclusive_duration_millis':0.886261},[[0,1,'Java/Simple/sqlTransaction',{'async_context':'main','exclusive_duration_millis':0.886261},[],'Simple','sqlTransaction']],'Simple','sqlTransaction'],{'userAttributes':{'test':'metric'},'intrinsics':{'traceId':'731f4eebda5f292c','guid':'731f4eebda5f292c','priority':1.825609,'sampled':true,'totalTime':8.86261E-4},'agentAttributes':{'request.uri':'Custom/Simple/sqlTransaction','jvm.thread_name':'main'}}]`,
        '731f4eebda5f292c',
        null,
        false
      ]
    ]
  },
  {
    key: 'span_event_data',
    data: [
      [
        {
          'traceId': 'd959974e17abe2b5',
          'duration': 0.011713522,
          'name': 'Nodejs/Test/span',
          'guid': 'b5ca3c76520b680a',
          'type': 'Span',
          'category': 'generic',
          'priority': 1.9650071,
          'sampled': true,
          'transactionId': 'd959974e17abe2b5',
          'nr.entryPoint': true,
          'timestamp': 1543864402820
        },
        {},
        {}
      ]
    ]
  },
  {
    key: 'custom_event_data',
    data: [[{ type: 'my_custom_typ', timestamp: 1543949274921 }, { foo: 'bar' }]]
  },
  {
    key: 'log_event_data',
    data: [
      {
        logs: [
          {
            'timestamp': '1649353816647',
            'log.level': 'INFO',
            'message': 'Unit testing',
            'span.id': '1122334455',
            'trace.id': 'aabbccddee'
          }
        ],
        common: {
          attributes: { 'entity.guid': 'guid', 'entity.name': 'test app', 'hostname': 'test-host' }
        }
      }
    ]
  }
]
apiMethods.forEach(({ key, data }) => {
  tap.test(key, (t) => {
    t.autoend()

    t.test('requires errors to send', (t) => {
      const agent = setupMockedAgent()
      const collectorApi = new CollectorApi(agent)

      t.teardown(() => {
        helper.unloadAgent(agent)
      })

      collectorApi.send(key, null, (err) => {
        t.ok(err)
        t.equal(err.message, `must pass data for ${key} to send`)

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
        collectorApi.send(key, [], null)
      }, new Error('callback is required'))
      t.end()
    })

    t.test('receiving 200 response, with valid data', (t) => {
      t.autoend()

      let agent = null
      let collectorApi = null

      let dataEndpoint = null

      t.beforeEach(() => {
        agent = setupMockedAgent()
        agent.config.run_id = RUN_ID
        collectorApi = new CollectorApi(agent)

        nock.disableNetConnect()

        const response = { return_value: [] }

        dataEndpoint = nock(URL)
          .post(helper.generateCollectorPath(key, RUN_ID))
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
        collectorApi.send(key, data, (error) => {
          t.error(error)

          dataEndpoint.done()

          t.end()
        })
      })

      t.test('should return retain state', (t) => {
        collectorApi.send(key, data, (error, res) => {
          t.error(error)
          const command = res

          t.equal(command.retainData, false)

          dataEndpoint.done()

          t.end()
        })
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
