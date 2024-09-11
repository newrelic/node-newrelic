/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const crypto = require('node:crypto')

const Collector = require('../../lib/test-collector')
const helper = require('../../lib/agent_helper')
const CollectorApi = require('../../../lib/collector/api')

const RUN_ID = 1337

test('reportSettings', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const collector = new Collector()
    ctx.nr.collector = collector
    await collector.listen()

    const config = Object.assign({}, collector.agentConfig, { config: { run_id: RUN_ID } })
    ctx.nr.agent = helper.loadMockedAgent(config)

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.collector.close()
  })

  await t.test('should not error out', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi.reportSettings((error) => {
      assert.equal(error, undefined)
      end()
    })
  })

  await t.test('should return the expected `empty` response', (t, end) => {
    const { collectorApi } = t.nr
    collectorApi.reportSettings((error, res) => {
      assert.deepStrictEqual(res.payload, [])
      end()
    })
  })

  await t.test('handles excessive payload sizes without blocking subsequent sends', (t, end) => {
    const { agent } = t.nr
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
    agent.logs.on('finished_data_send-log_event_data', () => {
      sends += 1
      if (sends === 3) {
        const logs = agent.logs.events.toArray()
        const found = logs.find((l) => /find me/.test(l))
        assert.notEqual(found, undefined)
        end()
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

test('shutdown', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const collector = new Collector()
    ctx.nr.collector = collector
    await collector.listen()
    collector.addHandler(helper.generateCollectorPath('shutdown', RUN_ID), (req, res) => {
      res.writeHead(503)
      res.end()
    })

    const config = Object.assign({}, collector.agentConfig, {
      app_name: ['TEST'],
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
    ctx.nr.agent = helper.loadMockedAgent(config)
    ctx.nr.agent.reconfig = () => {}
    ctx.nr.agent.setState = () => {}

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.collector.close()
  })

  await t.test('should not error out', (t, end) => {
    const { collectorApi } = t.nr

    collectorApi.shutdown((error) => {
      assert.equal(error, undefined)
      end()
    })
  })

  await t.test('should no longer have agent run id', (t, end) => {
    const { agent, collectorApi } = t.nr

    collectorApi.shutdown(() => {
      assert.equal(agent.config.run_id, undefined)
      end()
    })
  })

  await t.test('should tell the requester to shut down', (t, end) => {
    const { collectorApi } = t.nr

    collectorApi.shutdown((error, res) => {
      assert.equal(error, undefined)
      assert.equal(res.shouldShutdownRun(), true)
      end()
    })
  })

  await t.test('throws if no callback provided', (t) => {
    try {
      t.nr.collectorApi.shutdown()
    } catch (error) {
      assert.equal(error.message, 'callback is required')
    }
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

test('api methods', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const collector = new Collector()
    ctx.nr.collector = collector
    await collector.listen()

    const config = Object.assign({}, collector.agentConfig, {
      app_name: ['TEST'],
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
    ctx.nr.agent = helper.loadMockedAgent(config)
    ctx.nr.agent.reconfigure = () => {}
    ctx.nr.agent.setState = () => {}
    ctx.nr.agent.config.run_id = RUN_ID

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.collector.close()
  })

  for (const method of apiMethods) {
    await t.test(`${method.key}: requires errors to send`, (t, end) => {
      const { collectorApi } = t.nr

      collectorApi.send(method.key, null, (error) => {
        assert.equal(error.message, `must pass data for ${method.key} to send`)
        end()
      })
    })

    await t.test(`${method.key}: requires a callback`, (t) => {
      const { collectorApi } = t.nr

      assert.throws(
        () => {
          collectorApi.send(method.key, [], null)
        },
        { message: 'callback is required' }
      )
    })

    await t.test(`${method.key}: should receive 200 without error`, (t, end) => {
      const { collector, collectorApi } = t.nr
      collector.addHandler(helper.generateCollectorPath(method.key, RUN_ID), async (req, res) => {
        const body = await req.body()
        const found = JSON.parse(body)

        let expected = method.data
        if (method.data.toJSON) {
          expected = method.data.toJSON()
        }
        assert.deepStrictEqual(found, expected)

        res.json({ payload: { return_value: [] } })
      })
      collectorApi.send(method.key, method.data, (error) => {
        assert.equal(error, undefined)
        end()
      })
    })

    await t.test(`${method.key}: should retain state for 200 responses`, (t, end) => {
      const { collector, collectorApi } = t.nr
      collector.addHandler(
        helper.generateCollectorPath(method.key, RUN_ID),
        collector.agentSettingsHandler
      )
      collectorApi.send(method.key, method.data, (error, res) => {
        assert.equal(error, undefined)
        assert.equal(res.retainData, false)
        end()
      })
    })
  }
})

test('send', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}

    const collector = new Collector()
    ctx.nr.collector = collector
    await collector.listen()

    const config = Object.assign({}, collector.agentConfig, {
      app_name: ['TEST'],
      utilization: {
        detect_aws: false,
        detect_pcf: false,
        detect_azure: false,
        detect_gcp: false,
        detect_docker: false
      },
      browser_monitoring: {},
      transaction_tracer: {},
      max_payload_size_in_bytes: 100
    })
    ctx.nr.agent = helper.loadMockedAgent(config)
    ctx.nr.agent.reconfigure = () => {}
    ctx.nr.agent.setState = () => {}
    ctx.nr.agent.config.run_id = RUN_ID

    ctx.nr.collectorApi = new CollectorApi(ctx.nr.agent)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.collector.close()
  })

  await t.test('handles payloads of excessive size', (t, end) => {
    const { agent, collector, collectorApi } = t.nr
    const data = [
      [
        { type: 'my_custom_typ', timestamp: 1543949274921 },
        { foo: 'a'.repeat(agent.config.max_payload_size_in_bytes + 1) }
      ]
    ]
    collector.addHandler(helper.generateCollectorPath('custom_event_data', RUN_ID), (req, res) => {
      res.writeHead(413)
      res.end()
    })
    collectorApi.send('custom_event_data', data, (error, result) => {
      assert.equal(error, undefined)
      assert.deepStrictEqual(result, { retainData: false })
      end()
    })
  })
})
