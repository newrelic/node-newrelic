'use strict'

var tap = require('tap')
var nock = require('nock')
var configurator = require('../../../lib/config')
var Agent = require('../../../lib/agent')
var Transaction = require('../../../lib/transaction')
var mockAWSInfo = require('../../lib/nock/aws').mockAWSInfo


nock.disableNetConnect()

tap.test('harvesting with a mocked collector that returns 503 on connect', function(t) {
  var RUN_ID = 1337
  var url = 'https://collector.newrelic.com'
  var agent = new Agent(configurator.initialize())
  var transaction = new Transaction(agent)
  agent.recordSupportability = () => {}


  function path(method, runID) {
    var fragment = '/agent_listener/invoke_raw_method?' +
      'marshal_format=json&protocol_version=16&' +
      'license_key=license%20key%20here&method=' + method

    if (runID) fragment += '&run_id=' + runID

    return fragment
  }
  // manually harvesting
  agent.config.no_immediate_harvest = true

  var returned = {return_value: {}}

  const connect = nock(url)
  connect
    .post(path('preconnect'))
    .reply(200, {return_value: 'collector.newrelic.com'})
  connect
    .post(path('connect'))
    .reply(200, {return_value: {agent_run_id: RUN_ID}})

  // Want to individually confirm each of these endpoints.
  const sendMetrics = nock(url).post(path('metric_data', RUN_ID)).reply(503, returned)
  const sendErrors = nock(url).post(path('error_data', RUN_ID)).reply(503, returned)
  const sendTrace = nock(url)
    .post(path('transaction_sample_data', RUN_ID))
    .reply(503, returned)

  const settings = nock(url)
  settings.post(path('agent_settings', RUN_ID)).reply(200, {return_value: []})

  const sendShutdown = nock(url)
  sendShutdown.post(path('shutdown', RUN_ID)).reply(200)

  // setup nock for AWS
  mockAWSInfo()

  agent.start(function(error, config) {
    t.notOk(error, 'got no error on connection')
    t.deepEqual(config, {agent_run_id: RUN_ID}, 'got configuration')
    t.ok(connect.isDone(), 'should perform connection stat startup')

    // need sample data to give the harvest cycle something to send
    agent.errors.add(transaction, new Error('test error'))
    agent.traces.trace = transaction.trace

    agent.harvest(function(error) {
      t.ok(error, 'error received on 503')
      t.equal(
        error.message,
        'Got HTTP 503 in response to metric_data.',
        'got expected error message'
      )

      t.ok(sendMetrics.isDone(), 'initial sent metrics...')
      t.notOk(sendErrors.isDone(), '...but did not send error data...')
      t.notOk(sendTrace.isDone(), '...and also did not send trace, because of 503')

      agent.stop(function() {
        t.ok(settings.isDone(), 'got agent_settings message')
        t.ok(sendShutdown.isDone(), 'got shutdown message')
        t.end()
      })
    })
  })
})

tap.test('merging metrics and errors after a 503', function(t) {
  t.plan(8)

  var RUN_ID = 1338
  var url = 'https://collector.newrelic.com'
  var agentConfig = configurator.initialize()
  agentConfig.utilization.detect_docker = false

  // Disable native metrics for these tests so they don't generate unpredictable
  // metrics.
  agentConfig.feature_flag.native_metrics = false

  var agent = new Agent(agentConfig)
  var transaction = new Transaction(agent)
  agent.recordSupportability = function() {}

  transaction.name = 'trans1'

  function path(method, runID) {
    var fragment = '/agent_listener/invoke_raw_method?' +
      'marshal_format=json&protocol_version=16&' +
      'license_key=license%20key%20here&method=' + method

    if (runID) fragment += '&run_id=' + runID

    return fragment
  }
  // manually harvesting
  agent.config.no_immediate_harvest = true

  const collector = nock(url)
  collector.post(path('preconnect')).reply(200, {return_value: 'collector.newrelic.com'})
  collector.post(path('connect')).reply(200, {return_value: {agent_run_id: RUN_ID}})
  collector.post(path('agent_settings', RUN_ID)).reply(200, {return_value: []})
  collector.post(path('metric_data', RUN_ID)).reply(503)
  collector.post(path('error_data', RUN_ID)).reply(503)
  collector.post(path('transaction_sample_data', RUN_ID)).reply(503)
  collector.post(path('shutdown', RUN_ID)).reply(200)

  agent.start(function() {
    agent.errors.add(transaction, new Error('test error'))

    transaction.end(function() {
      agent.traces.trace = transaction.trace

      agent.harvest(function(error) {
        t.ok(error, 'should have gotten back error for 503')

        t.equal(agent.errors.errors.length, 1, 'errors were merged back in')
        var merged = agent.errors.errors[0]
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

        agent.stop(function() {})
      })

      t.ok(agent.metrics.empty, 'should have cleared metrics on harvest')
      t.equal(agent.metrics.toJSON().length, 0, 'should have no metrics')
    })
  })
})
