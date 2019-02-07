'use strict'

const tap = require('tap')
const nock = require('nock')
const configurator = require('../../../lib/config')
const Agent = require('../../../lib/agent')
const Transaction = require('../../../lib/transaction')
const mockAWSInfo = require('../../lib/nock/aws').mockAWSInfo
const helper = require('../../lib/agent_helper')

const RUN_ID = 1337
const ENDPOINTS = helper.generateAllPaths(RUN_ID)

nock.disableNetConnect()

tap.test('harvesting with a mocked collector that returns 413 on connect', (t) => {
  const url = 'https://collector.newrelic.com'
  const agent = new Agent(configurator.initialize())
  const transaction = new Transaction(agent)

  // manually harvesting
  agent.config.no_immediate_harvest = true

  // turn off native metrics to avoid unwanted gc metrics
  agent.config.plugins.native_metrics.enabled = false

  const redirect = nock(url).post(ENDPOINTS.PRECONNECT)
    .reply(200, {return_value: 'collector.newrelic.com'})
  const handshake = nock(url).post(ENDPOINTS.CONNECT)
    .reply(200, {return_value: {agent_run_id: RUN_ID}})
  const settings = nock(url).post(ENDPOINTS.SETTINGS).reply(200, {return_value: []})
  const sendMetrics = nock(url).post(ENDPOINTS.METRICS).reply(413)
  const sendEvents = nock(url).post(ENDPOINTS.EVENTS).reply(413)
  const sendErrors = nock(url).post(ENDPOINTS.ERRORS).reply(413)
  const sendErrorEvents = nock(url).post(ENDPOINTS.ERROR_EVENTS).reply(413)
  const sendTrace = nock(url).post(ENDPOINTS.TRACES).reply(413)
  const sendShutdown = nock(url).post(ENDPOINTS.SHUTDOWN).reply(200)

  // setup nock for AWS
  mockAWSInfo()

  agent.start((error, config) => {
    t.notOk(error, 'got no error on connection')
    t.deepEqual(config, {agent_run_id: RUN_ID}, 'got configuration')
    t.ok(redirect.isDone(), 'requested redirect')
    t.ok(handshake.isDone(), 'got handshake')

    // need sample data to give the harvest cycle something to send
    agent.errors.add(transaction, new Error('test error'))

    transaction.end()
    agent.traces.trace = transaction.trace

    agent.harvest((error) => {
      t.notOk(error, 'no error received on 413')
      t.ok(sendMetrics.isDone(), 'initial sent metrics...')
      t.ok(sendEvents.isDone(), '...and then sent events...')
      t.ok(sendErrors.isDone(), '...and then sent error data...')
      t.ok(sendTrace.isDone(), '...and then sent trace, even though all returned 413')
      t.ok(sendErrorEvents.isDone(), '...and then sent error events')

      agent.stop(() => {
        t.ok(settings.isDone(), 'got agent_settings message')
        t.ok(sendShutdown.isDone(), 'got shutdown message')
        t.end()
      })
    })
  })
})

tap.test('discarding metrics and errors after a 413', (t) => {
  t.plan(3)

  const url = 'https://collector.newrelic.com'
  const agent = new Agent(configurator.initialize())
  const transaction = new Transaction(agent)

  // manually harvesting
  agent.config.no_immediate_harvest = true

  // turn off native metrics to avoid unwanted gc metrics
  agent.config.plugins.native_metrics.enabled = false

  nock(url).post(ENDPOINTS.PRECONNECT)
    .reply(200, {return_value: 'collector.newrelic.com'})

  nock(url).post(ENDPOINTS.CONNECT)
    .reply(200, {return_value: {agent_run_id: RUN_ID}})
  nock(url).post(ENDPOINTS.SETTINGS)
    .reply(200, {return_value: []})

  nock(url).post(ENDPOINTS.METRICS).reply(413)
  nock(url).post(ENDPOINTS.ERRORS).reply(413)
  nock(url).post(ENDPOINTS.TRACES).reply(413)

  nock(url).post(ENDPOINTS.SHUTDOWN).reply(200)

  agent.start(() => {
    // need sample data to give the harvest cycle something to send
    agent.errors.add(transaction, new Error('test error'))
    agent.traces.trace = transaction.trace

    agent.harvest((error) => {
      t.notOk(error, 'should not have gotten back error for 413')
      t.equal(agent.errors.errors.length, 0, 'errors were discarded')
      t.deepEqual(agent.metrics.toJSON(), [], 'metrics were discarded')

      agent.stop(() => {})
    })
  })
})
