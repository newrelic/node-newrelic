'use strict'

const helper = require('../../lib/agent_helper')
const sinon = require('sinon')
const tap = require('tap')

const DESTS = require('../../../lib/config/attribute-filter').DESTINATIONS

tap.test('Agent#harvest', (t) => {
  t.autoend()

  let agent = null

  t.beforeEach((done) => {
    agent = helper.instrumentMockedAgent(null, {
      ssl: true,
      app_name: 'node.js Tests',
      license_key: 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
      host: 'staging-collector.newrelic.com',
      port: 443,
      ssl: true,
      utilization: {
        detect_aws: false,
        detect_pcf: false,
        detect_gcp: false,
        detect_docker: false
      },
      logging: {
        level: 'trace'
      },
      attributes: {enabled: true}
    })

    agent.start(done)
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    agent.stop((err) => {
      done(err)
    })
  })

  t.test('simple harvest', (t) => {
    agent.metrics.measureMilliseconds('TEST/discard', null, 101)

    var transaction
    var proxy = agent.tracer.transactionProxy(function() {
      transaction = agent.getTransaction()
      transaction.finalizeNameFromUri('/nonexistent', 501)
    })
    proxy()
    // ensure it's slow enough to get traced
    transaction.trace.setDurationInMillis(5001)
    transaction.end(function() {
      t.ok(agent.traces.trace, 'have a slow trace to send')

      agent.harvest(function(error) {
        t.error(error, 'harvest ran correctly')
        t.end()
      })
    })
  })

  t.test('sending metrics', (t) => {
    t.plan(5)
    agent.metrics.measureMilliseconds('TEST/discard', null, 101)

    var metrics = agent.metrics.toJSON()
    t.ok(findMetric(metrics, 'TEST/discard'), 'the test metric should be present')

    const spy = sinon.spy(agent.collector, 'metricData')
    t.tearDown(() => spy.restore())

    agent.harvest((error) => {
      t.error(error, 'should send metrics without error')

      t.ok(spy.called, 'should send metric data')

      const payload = spy.args[0][0]
      t.ok(payload, 'should have payload')
      t.deepEqual(payload[3][0][0], {name: 'TEST/discard'}, 'should have test metric')

      t.end()
    })
  })

  t.test('sending errors', (t) => {
    t.plan(5)

    const spy = sinon.spy(agent.collector, 'errorData')
    t.tearDown(() => spy.restore())

    agent.on('transactionFinished', () => {
      agent.harvest((error) => {
        t.error(error, 'sent errors without error')

        t.ok(spy.called, 'should send error data')

        const payload = spy.args[0][0]
        t.ok(payload, 'should get the payload')

        const errData = payload[1][0][4]
        t.ok(errData, 'should contain error information')
        const attrs = errData.agentAttributes
        t.deepEqual(
          attrs,
          {foo: 'bar', 'request.uri': '/nonexistent'},
          'should have the correct attributes'
        )

        t.end()
      })
    })

    helper.runInTransaction(agent, (tx) => {
      tx.finalizeNameFromUri('/nonexistent', 501)
      tx.trace.addAttribute(DESTS.ERROR_EVENT, 'foo', 'bar')
      tx.trace.addAttribute(DESTS.ERROR_EVENT, 'request.uri', '/nonexistent')
      agent.errors.add(tx, new Error('test error'))
      tx.end()
    })
  })

  t.test('sending traces', (t) => {
    t.plan(6)

    const spy = sinon.spy(agent.collector, 'transactionSampleData')
    t.tearDown(() => spy.restore())

    var transaction
    var proxy = agent.tracer.transactionProxy(() => {
      transaction = agent.getTransaction()
      transaction.finalizeNameFromUri('/nonexistent', 200)
    })
    proxy()

    // ensure it's slow enough to get traced
    transaction.trace.setDurationInMillis(5001)
    transaction.end(() => {
      t.ok(agent.traces.trace, 'have a slow trace to send')

      agent.harvest((error) => {
        t.error(error, 'trace sent correctly')

        t.ok(spy.called, 'should send sample trace data')

        const payload = spy.args[0][0]
        t.ok(payload, 'should have trace payload')
        t.type(payload[1][0], 'Array', 'should have trace')
        t.type(payload[1][0][4], 'string', 'should have encoded trace')

        t.end()
      })
    })
  })

  t.test('sending span events', (t) => {
    t.plan(6)

    agent.config.feature_flag.distributed_tracing = true
    agent.config.span_events.enabled = true

    const spy = sinon.spy(agent.collector, 'spanEvents')
    t.tearDown(() => spy.restore())

    helper.runInTransaction(agent, (tx) => {
      setTimeout(() => {
        // Just to create an extra span.
        tx.finalizeNameFromUri('/some/path', 200)
        tx.end(doHarvest)
      }, 10)
    })

    function doHarvest() {
      t.equal(agent.spans.length, 3, 'have spans to send')

      agent.harvest((error) => {
        t.error(error, 'trace sent correctly')

        t.ok(spy.called, 'should send span event data')

        const payload = spy.args[0][0]
        t.ok(payload, 'should have trace payload')
        t.type(payload[2], 'Array', 'should have spans')
        t.equal(payload[2].length, 3, 'should have all spans')

        t.end()
      })
    }
  })
})

function findMetric(metrics, name) {
  for (var i = 0; i < metrics.length; i++) {
    var metric = metrics[i]
    if (metric[0].name === name) return metric
  }
}
