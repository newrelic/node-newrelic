'use strict'

var test = require('tap').test
var nock = require('nock')
var configurator = require('../../../lib/config.js')
var Agent = require('../../../lib/agent.js')
var Transaction = require('../../../lib/transaction')
var mockAWSInfo = require('../../lib/nock/aws.js').mockAWSInfo


nock.disableNetConnect()

test("harvesting with a mocked collector that returns 503 after connect", function(t) {
  var RUN_ID = 1337
  var url = 'https://collector.newrelic.com'
  var agent = new Agent(configurator.initialize())
  var transaction = new Transaction(agent)
  agent.recordSupportability = function() {}


  function path(method, runID) {
    var fragment = '/agent_listener/invoke_raw_method?' +
      'marshal_format=json&protocol_version=14&' +
      'license_key=license%20key%20here&method=' + method

    if (runID) fragment += '&run_id=' + runID

    return fragment
  }
  // manually harvesting
  agent.config.no_immediate_harvest = true

  var returned = {return_value : {}}

  var redirect = nock(url).post(path('get_redirect_host'))
                   .reply(200, {return_value : "collector.newrelic.com"})

  var handshake = nock(url).post(path('connect'))
                    .reply(200, {return_value : {agent_run_id : RUN_ID}})
  var settings = nock(url).post(path('agent_settings', RUN_ID))
                   .reply(200, {return_value : []})

  var sendMetrics = nock(url).post(path('metric_data', RUN_ID)).reply(503, returned)
  var sendErrors = nock(url).post(path('error_data', RUN_ID)).reply(503, returned)
  var sendTrace = nock(url).post(path('transaction_sample_data', RUN_ID))
                      .reply(503, returned)


  var sendShutdown = nock(url).post(path('shutdown', RUN_ID)).reply(200)

  // setup nock for AWS
  mockAWSInfo()

  agent.start(function cb_start(error, config) {
    t.notOk(error, 'got no error on connection')
    t.deepEqual(config, {agent_run_id : RUN_ID}, 'got configuration')
    t.ok(redirect.isDone(),    "requested redirect")
    t.ok(handshake.isDone(),   "got handshake")

    // need sample data to give the harvest cycle something to send
    agent.errors.add(transaction, new Error('test error'))
    agent.traces.trace = transaction.trace

    agent.harvest(function cb_harvest(error) {
      t.ok(error, "error received on 503")
      t.equal(error.message, 'Got HTTP 503 in response to metric_data.',
              "got expected error message")
      t.ok(sendMetrics.isDone(), "initial sent metrics...")
      t.notOk(sendErrors.isDone(),  "...but didn't send error data...")
      t.notOk(sendTrace.isDone(),   "...and also didn't send trace, because of 503")

      agent.stop(function cb_stop() {
        t.ok(settings.isDone(), "got agent_settings message")
        t.ok(sendShutdown.isDone(), "got shutdown message")
        t.end()
      })
    })
  })
})

test("merging metrics and errors after a 503", function(t) {
  t.plan(6)

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
      'marshal_format=json&protocol_version=14&' +
      'license_key=license%20key%20here&method=' + method

    if (runID) fragment += '&run_id=' + runID

    return fragment
  }
  // manually harvesting
  agent.config.no_immediate_harvest = true

  nock(url).post(path('get_redirect_host'))
           .reply(200, {return_value : "collector.newrelic.com"})

  nock(url).post(path('connect'))
           .reply(200, {return_value : {agent_run_id : RUN_ID}})
  nock(url).post(path('agent_settings', RUN_ID))
           .reply(200, {return_value : []})

  nock(url).post(path('metric_data', RUN_ID)).reply(503)
  nock(url).post(path('error_data', RUN_ID)).reply(503)
  nock(url).post(path('transaction_sample_data', RUN_ID)).reply(503)

  nock(url).post(path('shutdown', RUN_ID)).reply(200)

  agent.start(function cb_start() {
    agent.errors.add(transaction, new Error('test error'))

    transaction.end(function() {
      agent.traces.trace = transaction.trace

      agent.harvest(function cb_harvest(error) {
        t.ok(error, "should have gotten back error for 503")

        t.equal(agent.errors.errors.length, 1, "errors were merged back in")
        var merged = agent.errors.errors[0]
        t.deepEqual(merged[0], 0, "found timestamp in merged error")
        t.deepEqual(merged[1], 'trans1', "found scope in merged error")
        t.deepEqual(merged[2], 'test error', "found message in merged error")

        t.deepEqual(
          agent.metrics.toJSON(),
          [[
            {name : "Errors/trans1"},
            {
              total          : 0,
              totalExclusive : 0,
              min            : 0,
              max            : 0,
              sumOfSquares   : 0,
              callCount      : 1
            }
          ],[
            {name : "Errors/all"},
            {
              total          : 0,
              totalExclusive : 0,
              min            : 0,
              max            : 0,
              sumOfSquares   : 0,
              callCount      : 1
            }
          ],[
            {name : "Errors/allWeb"},
            {
              total          : 0,
              totalExclusive : 0,
              min            : 0,
              max            : 0,
              sumOfSquares   : 0,
              callCount      : 1
            }
          ],[
            {name : "Errors/allOther"},
            {
              total          : 0,
              totalExclusive : 0,
              min            : 0,
              max            : 0,
              sumOfSquares   : 0,
              callCount      : 0
            }
          ],[
            // Bluebird is a dependency of tap, and since tap is loaded before
            // the agent, it will be caught in the "Uninstrumented" metrics.
            {name: "Supportability/Uninstrumented"},
            {
              total          : 0,
              totalExclusive : 0,
              min            : 0,
              max            : 0,
              sumOfSquares   : 0,
              callCount      : 1
            }
          ],[
            {name: "Supportability/Uninstrumented/bluebird"},
            {
              total          : 0,
              totalExclusive : 0,
              min            : 0,
              max            : 0,
              sumOfSquares   : 0,
              callCount      : 1
            }
          ],[
            {
              "name" : "Supportability/Events/Customer/Dropped" // != undefined
            },{
              "total" : 0, // != undefined
              "totalExclusive" : 0, // != undefined
              "min" : 0, // != undefined
              "max" : 0, // != undefined
              "sumOfSquares" : 0, // != undefined
              "callCount" : 0 // != undefined
            }
          ],[
            {
              "name" : "Supportability/Events/Customer/Seen" // != undefined
            },{
              "total" : 0, // != undefined
              "totalExclusive" : 0, // != undefined
              "min" : 0, // != undefined
              "max" : 0, // != undefined
              "sumOfSquares" : 0, // != undefined
              "callCount" : 0 // != undefined
            }
          ],[
            {
              "name" : "Supportability/Events/Customer/Sent" // != undefined
            },{
              "total" : 0, // != undefined
              "totalExclusive" : 0, // != undefined
              "min" : 0, // != undefined
              "max" : 0, // != undefined
              "sumOfSquares" : 0, // != undefined
              "callCount" : 0 // != undefined
            }
          ],[
            {
              "name" : "Supportability/Events/TransactionError/Seen" // != undefined
            },{
              "total" : 0, // != undefined
              "totalExclusive" : 0, // != undefined
              "min" : 0, // != undefined
              "max" : 0, // != undefined
              "sumOfSquares" : 0, // != undefined
              "callCount" : 1 // != undefined
            }
          ],[
            {
              "name" : "Supportability/Events/TransactionError/Sent" // != undefined
            },{
              "total" : 0, // != undefined
              "totalExclusive" : 0, // != undefined
              "min" : 0, // != undefined
              "max" : 0, // != undefined
              "sumOfSquares" : 0, // != undefined
              "callCount" : 1 // != undefined
            }]
          ],
          "metrics were merged"
        )

        agent.stop(function cb_stop() {})
      })
    })
  })
})
