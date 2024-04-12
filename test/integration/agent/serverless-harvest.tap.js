/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const fs = require('fs')

const helper = require('../../lib/agent_helper')
const tap = require('tap')
const sinon = require('sinon')
const API = require('../../../api')
const util = require('util')

const DESTS = require('../../../lib/config/attribute-filter').DESTINATIONS
const TEST_ARN = 'test:arn'
const TEST_FUNC_VERSION = '$LATEST'
const TEST_EX_ENV = 'test-AWS_Lambda_nodejs8.10'
const PROTOCOL_VERSION = 16

tap.test('Serverless mode harvest', (t) => {
  t.autoend()

  let agent = null
  let logSpy = null

  process.env.AWS_EXECUTION_ENV = TEST_EX_ENV

  t.beforeEach(async () => {
    logSpy = sinon.spy(fs, 'writeSync')
    agent = helper.instrumentMockedAgent({
      serverless_mode: {
        enabled: true
      },
      app_name: 'serverless mode tests',
      license_key: '' // serverless mode doesn't require license key
    })
    agent.setLambdaArn(TEST_ARN)
    agent.setLambdaFunctionVersion(TEST_FUNC_VERSION)

    const agentStart = util.promisify(agent.start).bind(agent)
    await agentStart()
  })

  t.afterEach(async () => {
    logSpy && logSpy.restore()
    helper.unloadAgent(agent)

    const agentStop = util.promisify(agent.stop).bind(agent)
    await agentStop()
  })

  t.test('simple harvest', (t) => {
    t.plan(5)
    let transaction
    const proxy = agent.tracer.transactionProxy(() => {
      transaction = agent.getTransaction()
      transaction.finalizeNameFromUri('/nonexistent', 501)
    })
    proxy()

    // ensure it's slow enough to get traced
    transaction.trace.setDurationInMillis(5001)
    transaction.end()
    agent.once('harvestFinished', () => {
      const payload = JSON.parse(logSpy.args[0][1])

      t.equal(payload[0], 1, 'payload has expected version')
      t.equal(payload[1], 'NR_LAMBDA_MONITORING', 'payload has expected marker')

      helper.decodeServerlessPayload(t, payload[2], (err, decoded) => {
        if (err) {
          return t.fail(err, 'decompression failed')
        }

        t.ok(decoded.metadata, 'decoded payload has metadata object')
        t.same(
          decoded.metadata,
          {
            arn: TEST_ARN,
            function_version: TEST_FUNC_VERSION,
            execution_environment: TEST_EX_ENV,
            protocol_version: PROTOCOL_VERSION,
            agent_version: agent.version,
            agent_language: 'nodejs'
          },
          'metadata object has expected data'
        )
        t.ok(decoded.data, 'decoded payload has data object')
        t.end()
      })
    })
    agent.harvestSync()
  })

  t.test('sending metrics', (t) => {
    t.plan(5)
    agent.metrics.measureMilliseconds('TEST/discard', null, 101)

    const metrics = agent.metrics._metrics.toJSON()
    t.ok(findMetric(metrics, 'TEST/discard'), 'the test metric should be present')

    let error
    try {
      agent.harvestSync()
    } catch (err) {
      error = err
    }
    t.error(error, 'should send metrics without error')

    checkCompressedPayload(
      t,
      findPayload(logSpy.args[0])[2],
      'metric_data',
      function checkData(payload) {
        t.ok(payload, 'should have a payload')
        t.same(payload[3][0][0], { name: 'TEST/discard' }, 'should have test metric')
        t.end()
      }
    )
  })

  t.test('sending error traces', (t) => {
    t.plan(4)

    helper.runInTransaction(agent, (tx) => {
      tx.finalizeNameFromUri('/nonexistent', 501)
      tx.trace.attributes.addAttribute(DESTS.ERROR_EVENT, 'foo', 'bar')
      tx.trace.attributes.addAttribute(DESTS.ERROR_EVENT, 'request.uri', '/nonexistent')
      agent.errors.add(tx, new Error('test error'))
      const spanId = agent.tracer.getSegment().id

      tx.end()
      agent.once('harvestFinished', () => {
        checkCompressedPayload(
          t,
          findPayload(logSpy.args[0])[2],
          'error_data',
          function checkData(payload) {
            t.ok(payload, 'should have a payload')
            const errData = payload[1][0][4]
            t.ok(errData, 'should contain error information')
            const attrs = errData.agentAttributes
            t.same(
              attrs,
              { 'foo': 'bar', 'request.uri': '/nonexistent', spanId },
              'should have the correct attributes'
            )
            t.end()
          }
        )
      })
      agent.harvestSync()
    })
  })

  t.test('sending traces', (t) => {
    t.plan(4)

    let transaction
    const proxy = agent.tracer.transactionProxy(() => {
      transaction = agent.getTransaction()
      transaction.finalizeNameFromUri('/nonexistent', 200)
    })
    proxy()

    // ensure it's slow enough to get traced
    transaction.trace.setDurationInMillis(5001)
    transaction.end()
    agent.once('harvestFinished', () => {
      checkCompressedPayload(
        t,
        findPayload(logSpy.args[0])[2],
        'transaction_sample_data',
        function checkData(payload) {
          t.ok(payload, 'should have trace payload')
          t.type(payload[1][0], 'Array', 'should have trace')
          t.type(payload[1][0][4], 'string', 'should have encoded trace')
          t.end()
        }
      )
    })
    agent.harvestSync()
  })

  t.test('serverless_mode harvest should disregard sampling limits', (t) => {
    t.plan(4)

    agent.config.transaction_events.max_samples_stored = 0

    let transaction
    const proxy = agent.tracer.transactionProxy(() => {
      transaction = agent.getTransaction()
      transaction.finalizeNameFromUri('/nonexistent', 200)
    })
    proxy()

    // ensure it's slow enough to get traced
    transaction.trace.setDurationInMillis(5001)
    transaction.end()
    agent.once('harvestFinished', () => {
      checkCompressedPayload(
        t,
        findPayload(logSpy.args[0])[2],
        'transaction_sample_data',
        function checkData(payload) {
          t.ok(payload, 'should have trace payload')
          t.type(payload[1][0], 'Array', 'should have trace')
          t.type(payload[1][0][4], 'string', 'should have encoded trace')
          t.end()
        }
      )
    })
    agent.harvestSync()
  })

  t.test('sending span events', (t) => {
    t.plan(4)

    agent.config.distributed_tracing.enabled = true
    agent.config.span_events.enabled = true

    helper.runInTransaction(agent, (tx) => {
      setTimeout(() => {
        // Just to create an extra span.
        tx.finalizeNameFromUri('/some/path', 200)
        tx.end()
        agent.once('harvestFinished', end)
        agent.harvestSync()
      }, 100)
    })

    function end() {
      checkCompressedPayload(
        t,
        findPayload(logSpy.args[0])[2],
        'span_event_data',
        function checkData(payload) {
          t.ok(payload, 'should have trace payload')
          t.type(payload[2], 'Array', 'should have spans')
          t.equal(payload[2].length, 2, 'should have all spans')
          t.end()
        }
      )
    }
  })

  t.test('sending error events', (t) => {
    helper.runInTransaction(agent, (tx) => {
      tx.finalizeNameFromUri('/nonexistent', 501)
      tx.trace.attributes.addAttribute(DESTS.ERROR_EVENT, 'foo', 'bar')
      tx.trace.attributes.addAttribute(DESTS.ERROR_EVENT, 'request.uri', '/nonexistent')
      agent.errors.add(tx, new Error('test error'))
      const spanId = agent.tracer.getSegment().id

      tx.end()
      agent.once('harvestFinished', () => {
        const rawPayload = findPayload(logSpy.args[0])
        const encodedData = rawPayload[2]

        checkCompressedPayload(t, encodedData, 'error_event_data', function checkData(payload) {
          t.ok(payload, 'should have a payload')

          const [runId, eventMetrics, eventData] = payload

          // runid should be null/undefined
          t.notOk(runId)

          t.equal(eventMetrics.events_seen, 1)

          const expectedSize = agent.config.error_collector.max_event_samples_stored
          t.equal(eventMetrics.reservoir_size, expectedSize)

          const errorEvent = eventData[0]
          const [intrinsicAttr /* skip user */, , agentAttr] = errorEvent

          t.equal(intrinsicAttr.type, 'TransactionError')

          t.same(
            agentAttr,
            { 'foo': 'bar', 'request.uri': '/nonexistent', spanId },
            'should have the correct attributes'
          )
          t.end()
        })
      })
      agent.harvestSync()
    })
  })

  t.test('sending custom events', (t) => {
    helper.runInTransaction(agent, (tx) => {
      tx.finalizeNameFromUri('/nonexistent', 501)

      const expectedEventType = 'myEvent'
      const expectedAttributes = { foo: 'bar' }

      const api = new API(agent)
      api.recordCustomEvent(expectedEventType, expectedAttributes)

      tx.end()
      agent.once('harvestFinished', () => {
        const rawPayload = findPayload(logSpy.args[0])
        const encodedData = rawPayload[2]

        checkCompressedPayload(t, encodedData, 'custom_event_data', function checkData(payload) {
          t.ok(payload, 'should have a payload')

          const [runId, eventData] = payload

          // runid should be null/undefined
          t.notOk(runId)

          const customEvent = eventData[0]
          const [intrinsicAttr, userAttr] = customEvent

          t.equal(intrinsicAttr.type, expectedEventType)

          t.same(userAttr, expectedAttributes, 'should have the correct attributes')
          t.end()
        })
      })
      agent.harvestSync()
    })
  })

  t.test('sending sql traces', (t) => {
    helper.runInTransaction(agent, (tx) => {
      const expectedUrl = '/nonexistent'

      tx.finalizeNameFromUri(expectedUrl, 501)

      agent.config.transaction_tracer.record_sql = 'raw'
      agent.config.transaction_tracer.explain_threshold = 0
      agent.config.slow_sql.enabled = true

      const expectedSql = 'select pg_sleep(1)'

      agent.queries.add(tx.trace.root, 'postgres', expectedSql, 'FAKE STACK')

      tx.end()
      agent.once('harvestFinished', () => {
        const rawPayload = findPayload(logSpy.args[0])
        const encodedData = rawPayload[2]

        checkCompressedPayload(t, encodedData, 'sql_trace_data', function checkData(payload) {
          t.ok(payload, 'should have a payload')

          const [runId, samples] = payload

          // runid should be null/undefined
          t.notOk(runId)

          const sample = samples[0]

          const transactionUrl = sample[1]
          const sql = sample[3]
          const count = sample[5]
          const encodedParams = sample[9]

          t.equal(transactionUrl, expectedUrl)
          t.equal(sql, expectedSql)
          t.equal(count, 1)

          // won't have anything interesting added this way
          t.ok(encodedParams)

          t.end()
        })
      })
      agent.harvestSync()
    })
  })
})

function findMetric(metrics, name) {
  for (let i = 0; i < metrics.length; i++) {
    const metric = metrics[i]
    if (metric[0].name === name) {
      return metric
    }
  }
}

function checkCompressedPayload(t, payload, prop, cb) {
  helper.decodeServerlessPayload(t, payload, (err, decoded) => {
    if (err) {
      return t.error(err)
    }

    const data = decoded.data[prop]
    t.ok(data, `compressed payload includes ${prop} prop`)

    for (const key in decoded.data) {
      if (!decoded.data[key].length) {
        t.fail(`payload data.${key} property is empty`)
      }
    }

    cb(decoded.data[prop])
  })
}

function findPayload(args) {
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i]
    if (typeof arg === 'string') {
      return JSON.parse(arg)
    }
  }
}
