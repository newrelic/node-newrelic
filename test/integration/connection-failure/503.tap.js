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

tap.test('harvesting with a mocked collector that returns 503 on connect', (t) => {
  const url = 'https://collector.newrelic.com'
  const agent = new Agent(configurator.initialize())
  const transaction = new Transaction(agent)
  agent.recordSupportability = () => {}

  // manually harvesting
  agent.config.no_immediate_harvest = true

  const returned = {return_value: {}}

  const connect = nock(url)
  connect
    .post(ENDPOINTS.PRECONNECT)
    .reply(200, {return_value: 'collector.newrelic.com'})
  connect
    .post(ENDPOINTS.CONNECT)
    .reply(200, {return_value: {agent_run_id: RUN_ID}})

  nock(url).post(ENDPOINTS.TRACES).reply(503, returned)

  // Want to individually confirm each of these endpoints.
  const sendMetrics = nock(url).post(ENDPOINTS.METRICS).reply(503, returned)
  const settings = nock(url).post(ENDPOINTS.SETTINGS).reply(200, {return_value: []})
  const sendShutdown = nock(url).post(ENDPOINTS.SHUTDOWN).reply(200)


  // setup nock for AWS
  mockAWSInfo()

  agent.start((error, config) => {
    t.notOk(error, 'got no error on connection')
    t.deepEqual(config, {agent_run_id: RUN_ID}, 'got configuration')
    t.ok(connect.isDone(), 'should perform connection stat startup')

    // need sample data to give the harvest cycle something to send
    agent.errors.add(transaction, new Error('test error'))
    agent.traces.trace = transaction.trace

    agent.harvest((err) => {
      t.error(err, 'collection error should stay inside collector')

      t.ok(sendMetrics.isDone(), 'initial sent metrics...')

      agent.stop(() => {
        t.ok(settings.isDone(), 'got agent_settings message')
        t.ok(sendShutdown.isDone(), 'got shutdown message')
        t.end()
      })
    })
  })
})

tap.test('merging metrics and errors after a 503', (t) => {
  t.plan(8)

  const url = 'https://collector.newrelic.com'
  const agentConfig = configurator.initialize()
  agentConfig.utilization.detect_docker = false

  // Disable native metrics for these tests so they don't generate unpredictable
  // metrics.
  agentConfig.plugins.native_metrics.enabled = false

  const agent = new Agent(agentConfig)
  const transaction = new Transaction(agent)
  agent.recordSupportability = () => {}

  transaction.name = 'trans1'

  // manually harvesting
  agent.config.no_immediate_harvest = true

  const collector = nock(url)
  collector.post(ENDPOINTS.PRECONNECT)
    .reply(200, {return_value: 'collector.newrelic.com'})
  collector.post(ENDPOINTS.CONNECT).reply(200, {return_value: {agent_run_id: RUN_ID}})
  collector.post(ENDPOINTS.SETTINGS).reply(200, {return_value: []})
  collector.post(ENDPOINTS.METRICS).reply(503)
  collector.post(ENDPOINTS.ERRORS).reply(503)
  collector.post(ENDPOINTS.ERROR_EVENTS).reply(503)
  collector.post(ENDPOINTS.EVENTS).reply(503)
  collector.post(ENDPOINTS.TRACES).reply(503)
  collector.post(ENDPOINTS.SHUTDOWN).reply(200)

  agent.start(() => {
    agent.errors.add(transaction, new Error('test error'))

    transaction.end()
    agent.traces.trace = transaction.trace

    agent.harvest((error) => {
      t.error(error, 'error should be contained by collector')

      t.equal(agent.errors.errors.length, 1, 'errors were merged back in')
      const merged = agent.errors.errors[0]
      t.deepEqual(merged[0], 0, 'found timestamp in merged error')
      t.deepEqual(merged[1], 'trans1', 'found scope in merged error')
      t.deepEqual(merged[2], 'test error', 'found message in merged error')

      // Sort the metrics by name and filter out supportabilities.
      const metrics = agent.metrics.toJSON().sort((a, b) => {
        const aName = a[0].name
        const bName = b[0].name
        return aName > bName ? 1 : aName < bName ? -1 : 0
      }).filter((m) => !/^Supportability\//.test(m[0].name))

      t.deepEqual(
        metrics,
        [[
          {name: 'Errors/all'},
          {
            total: 0,
            totalExclusive: 0,
            min: 0,
            max: 0,
            sumOfSquares: 0,
            callCount: 1
          }
        ], [
          {name: 'Errors/allOther'},
          {
            total: 0,
            totalExclusive: 0,
            min: 0,
            max: 0,
            sumOfSquares: 0,
            callCount: 0
          }
        ], [
          {name: 'Errors/allWeb'},
          {
            total: 0,
            totalExclusive: 0,
            min: 0,
            max: 0,
            sumOfSquares: 0,
            callCount: 1
          }
        ], [
          {name: 'Errors/trans1'},
          {
            total: 0,
            totalExclusive: 0,
            min: 0,
            max: 0,
            sumOfSquares: 0,
            callCount: 1
          }
        ]],
        'metrics were merged'
      )

      agent.stop(() => {})
    })

    t.ok(agent.metrics.empty, 'should have cleared metrics on harvest')
    t.equal(agent.metrics.toJSON().length, 0, 'should have no metrics')
  })
})
