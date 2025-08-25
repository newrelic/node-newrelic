/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const util = require('node:util')
const fs = require('node:fs')
const tspl = require('@matteo.collina/tspl')

const helper = require('../../lib/agent_helper')
const API = require('../../../api')

const DESTS = require('../../../lib/config/attribute-filter').DESTINATIONS
const TEST_ARN = 'test:arn'
const TEST_FUNC_VERSION = '$LATEST'
const TEST_EX_ENV = 'test-AWS_Lambda_nodejs8.10'
const PROTOCOL_VERSION = 16

test.beforeEach(async (ctx) => {
  process.env.AWS_EXECUTION_ENV = TEST_EX_ENV

  ctx.nr = {}

  // The ServerlessCollector ultimately performs a `fs.writeSyc` to the
  // `stdout.fd` in order to issue logs for CloudWatch to pick up. We want
  // to verify those logs in these tests, and also suppress their output
  // during the tests. So we monkey patch the function.
  ctx.nr.fsWriteSync = fs.writeSync
  ctx.nr.writeLogs = []
  fs.writeSync = (target, data) => {
    ctx.nr.writeLogs.push(data)
  }

  ctx.nr.agent = helper.instrumentMockedAgent({
    serverless_mode: { enabled: true },
    app_name: 'serverless mode tests',
    license_key: '' // serverless mode doesn't require license key
  })
  ctx.nr.agent.setLambdaArn(TEST_ARN)
  ctx.nr.agent.setLambdaFunctionVersion(TEST_FUNC_VERSION)

  const agentStart = util.promisify(ctx.nr.agent.start).bind(ctx.nr.agent)
  await agentStart()
})

test.afterEach(async (ctx) => {
  delete process.env.AWS_EXECUTION_ENV

  fs.writeSync = ctx.nr.fsWriteSync
  helper.unloadAgent(ctx.nr.agent)

  const agentStop = util.promisify(ctx.nr.agent.stop).bind(ctx.nr.agent)
  await agentStop()
})

test('simple harvest', async (t) => {
  const { agent } = t.nr
  const plan = tspl(t, { plan: 6 })

  let transaction
  const proxy = agent.tracer.transactionProxy(() => {
    transaction = agent.getTransaction()
    transaction.parsedUrl = new URL('/nonexistent', 'http://localhost')
    transaction.finalizeNameFromUri('/nonexistent', 501)
  })
  proxy()

  // Ensure it's slow enough to get traced.
  transaction.trace.setDurationInMillis(5_001)
  transaction.end()
  agent.once('harvestFinished', () => {
    const payload = JSON.parse(t.nr.writeLogs.shift())

    plan.equal(payload[0], 1, 'payload has expected version')
    plan.equal(payload[1], 'NR_LAMBDA_MONITORING', 'payload has expected marker')

    helper.decodeServerlessPayload(payload[2], (error, decoded) => {
      plan.ifError(error, 'decompression should not fail')
      plan.ok(decoded.metadata, 'decoded payload has metadata object')
      plan.deepStrictEqual(
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
      plan.ok(decoded.data, 'decoded payload has data object')
    })
  })
  agent.harvestSync()

  await plan.completed
})

test('sending metrics', async (t) => {
  const plan = tspl(t, { plan: 6 })
  const { agent } = t.nr
  agent.metrics.measureMilliseconds('TEST/discard', null, 101)

  const metrics = agent.metrics._metrics.toJSON()
  plan.ok(findMetric(metrics, 'TEST/discard'), 'the test metric should be present')

  let error
  try {
    agent.harvestSync()
  } catch (err) {
    error = err
  }
  plan.ifError(error, 'should send metrics without error')

  checkCompressedPayload(
    plan,
    findPayload(t.nr.writeLogs)[2],
    'metric_data',
    function checkData(payload) {
      plan.ok(payload, 'should have a payload')
      plan.deepStrictEqual(payload[3][0][0], { name: 'TEST/discard' }, 'should have test metric')
    }
  )

  await plan.completed
})

test('sending error traces', async (t) => {
  const plan = tspl(t, { plan: 5 })
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    tx.finalizeNameFromUri('/nonexistent', 501)
    tx.trace.attributes.addAttribute(DESTS.ERROR_EVENT, 'foo', 'bar')
    tx.trace.attributes.addAttribute(DESTS.ERROR_EVENT, 'request.uri', '/nonexistent')
    agent.errors.add(tx, new Error('test error'))
    const spanId = agent.tracer.getSegment().id

    tx.end()
    agent.once('harvestFinished', () => {
      checkCompressedPayload(
        plan,
        findPayload(t.nr.writeLogs)[2],
        'error_data',
        function checkData(payload) {
          plan.ok(payload, 'should have a payload')
          const errData = payload[1][0][4]
          plan.ok(errData, 'should contain error information')
          const attrs = errData.agentAttributes
          plan.deepStrictEqual(
            attrs,
            { foo: 'bar', 'request.uri': '/nonexistent', spanId },
            'should have the correct attributes'
          )
        }
      )
    })
    agent.harvestSync()
  })

  await plan.completed
})

test('sending traces', async (t) => {
  const plan = tspl(t, { plan: 5 })
  const { agent } = t.nr

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
      plan,
      findPayload(t.nr.writeLogs)[2],
      'transaction_sample_data',
      function checkData(payload) {
        plan.ok(payload, 'should have trace payload')
        plan.equal(Array.isArray(payload[1][0]), true, 'should have trace')
        plan.equal(typeof payload[1][0][4] === 'string', true, 'should have encoded trace')
      }
    )
  })
  agent.harvestSync()

  await plan.completed
})

test('serverless_mode harvest should disregard sampling limits', async (t) => {
  const plan = tspl(t, { plan: 5 })
  const { agent } = t.nr

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
      plan,
      findPayload(t.nr.writeLogs)[2],
      'transaction_sample_data',
      function checkData(payload) {
        plan.ok(payload, 'should have trace payload')
        plan.equal(Array.isArray(payload[1][0]), true, 'should have trace')
        plan.equal(typeof payload[1][0][4] === 'string', true, 'should have encoded trace')
      }
    )
  })
  agent.harvestSync()

  await plan.completed
})

test('sending span events', async (t) => {
  const plan = tspl(t, { plan: 5 })
  const { agent } = t.nr

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

  await plan.completed

  function end() {
    checkCompressedPayload(
      plan,
      findPayload(t.nr.writeLogs)[2],
      'span_event_data',
      function checkData(payload) {
        plan.ok(payload, 'should have trace payload')
        plan.equal(Array.isArray(payload[2]), true, 'should have spans')
        plan.equal(payload[2].length, 2, 'should have all spans')
      }
    )
  }
})

test('sending error events', async (t) => {
  const plan = tspl(t, { plan: 8 })
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    tx.finalizeNameFromUri('/nonexistent', 501)
    tx.trace.attributes.addAttribute(DESTS.ERROR_EVENT, 'foo', 'bar')
    tx.trace.attributes.addAttribute(DESTS.ERROR_EVENT, 'request.uri', '/nonexistent')
    agent.errors.add(tx, new Error('test error'))
    const spanId = agent.tracer.getSegment().id

    tx.end()
    agent.once('harvestFinished', () => {
      const rawPayload = findPayload(t.nr.writeLogs)
      const encodedData = rawPayload[2]

      checkCompressedPayload(plan, encodedData, 'error_event_data', function checkData(payload) {
        plan.ok(payload, 'should have a payload')

        const [runId, eventMetrics, eventData] = payload

        // runid should be null/undefined
        plan.equal(runId, undefined)

        plan.equal(eventMetrics.events_seen, 1)

        const expectedSize = agent.config.error_collector.max_event_samples_stored
        plan.equal(eventMetrics.reservoir_size, expectedSize)

        const errorEvent = eventData[0]
        const [intrinsicAttr /* skip user */, , agentAttr] = errorEvent

        plan.equal(intrinsicAttr.type, 'TransactionError')

        plan.deepStrictEqual(
          agentAttr,
          { foo: 'bar', 'request.uri': '/nonexistent', spanId },
          'should have the correct attributes'
        )
      })
    })
    agent.harvestSync()
  })

  await plan.completed
})

test('sending custom events', async (t) => {
  const plan = tspl(t, { plan: 6 })
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    tx.finalizeNameFromUri('/nonexistent', 501)

    const expectedEventType = 'myEvent'
    const expectedAttributes = { foo: 'bar' }

    const api = new API(agent)
    api.recordCustomEvent(expectedEventType, expectedAttributes)

    tx.end()
    agent.once('harvestFinished', () => {
      const rawPayload = findPayload(t.nr.writeLogs)
      const encodedData = rawPayload[2]

      checkCompressedPayload(plan, encodedData, 'custom_event_data', function checkData(payload) {
        plan.ok(payload, 'should have a payload')

        const [runId, eventData] = payload

        // runid should be null/undefined
        plan.equal(runId, undefined)

        const customEvent = eventData[0]
        const [intrinsicAttr, userAttr] = customEvent

        plan.equal(intrinsicAttr.type, expectedEventType)

        plan.deepStrictEqual(userAttr, expectedAttributes, 'should have the correct attributes')
      })
    })
    agent.harvestSync()
  })

  await plan.completed
})

test('sending sql traces', async (t) => {
  const plan = tspl(t, { plan: 8 })
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const expectedUrl = '/nonexistent'

    // TODO: would this be a connection url?
    tx.parsedUrl = new URL(expectedUrl, 'http://localhost')
    tx.url = tx.parsedUrl.pathname
    tx.finalizeNameFromUri(expectedUrl, 501)

    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.transaction_tracer.explain_threshold = 0
    agent.config.slow_sql.enabled = true

    const expectedSql = 'select pg_sleep(1)'

    agent.queries.add({
      transaction: tx,
      segment: tx.trace.root,
      type: 'postgres',
      query: expectedSql,
      trace: 'FAKE STACK'
    })
    tx.end()
    agent.once('harvestFinished', () => {
      const rawPayload = findPayload(t.nr.writeLogs)
      const encodedData = rawPayload[2]

      checkCompressedPayload(plan, encodedData, 'sql_trace_data', function checkData(payload) {
        plan.ok(payload, 'should have a payload')

        const [runId, samples] = payload

        // runid should be null/undefined
        plan.equal(runId, undefined)

        const sample = samples[0]

        const transactionUrl = sample[1]
        const sql = sample[3]
        const count = sample[5]
        const encodedParams = sample[9]

        plan.equal(transactionUrl, expectedUrl)
        plan.equal(sql, expectedSql)
        plan.equal(count, 1)

        // won't have anything interesting added this way
        plan.ok(encodedParams)
      })
    })
    agent.harvestSync()
  })

  await plan.completed
})

function findMetric(metrics, name) {
  for (let i = 0; i < metrics.length; i++) {
    const metric = metrics[i]
    if (metric[0].name === name) {
      return metric
    }
  }
}

function checkCompressedPayload(plan, payload, prop, cb) {
  helper.decodeServerlessPayload(payload, (err, decoded) => {
    plan.ifError(err)

    const data = decoded.data[prop]
    plan.ok(data, `compressed payload includes ${prop} prop`)

    for (const key in decoded.data) {
      if (!decoded.data[key].length) {
        plan.fail(`payload data.${key} property is empty`)
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
