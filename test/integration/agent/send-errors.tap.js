'use strict'

var helper = require('../../lib/agent_helper')
var path = require('path')
var test = require('tap').test
var Agent = require('../../../lib/agent')

test('Agent#_sendErrors', function(t) {
  var config = {
    'app_name': 'node.js Tests',
    'license_key': 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
    'host': 'staging-collector.newrelic.com',
    'port': 80,
    'ssl': false,
    'utilization': {
      'detect_aws': false,
      'detect_docker': false
    },
    'logging': {
      'level': 'trace'
    }
  }

  t.test('without ssl', function(t) {
    config.port = 80
    config.ssl = false
    var agent = setupAgent(t, config)
    _testSendErrors(t, agent)
  })

  t.test('with ssl', function(t) {
    config.port = 443
    config.ssl = true
    var agent = setupAgent(t, config)
    _testSendErrors(t, agent)
  })

  function _testSendErrors(t, agent) {
    t.plan(6)

    agent.start(function(err) {
      if (!t.notOk(err, 'should connect without error')) {
        console.log('Connection error:', err)
        return t.end()
      }

      agent.collector.errorData = function(payload, cb) {
        // console.log('errorData', payload)
        if (!t.ok(payload, 'should get the payload')) {
          return cb()
        }

        var errData = payload[1][0][4]
        if (!t.ok(errData, 'should contain error information')) {
          return cb()
        }

        t.equal(errData.request_uri, '/nonexistent', 'should have request_uri')

        var attrs = errData.agentAttributes
        t.deepEqual(attrs, {foo: 'bar'}, 'should have the correct attributes')

        cb()
      }

      agent.on('transactionFinished', function(transaction) {
        agent._sendErrors(function(error) {
          if (!t.notOk(error, "sent errors without error")) {
            console.log('Send error:', error)
          }

          agent.stop(function(error) {
            t.notOk(error, "stopped without error")

            t.end()
          })
        })
      })

      helper.runInTransaction(agent, function(tx) {
        tx.setName('/nonexistent', 501)
        tx.addAgentAttribute('foo', 'bar')
        tx.addAgentAttribute('request_uri', '/nonexistent')
        agent.errors.add(tx, new Error('test error'))
        tx.end()
      })
    })
  }

  function setupAgent(t, config) {
    var agent = helper.loadMockedAgent({'send_request_uri_attribute': true}, config)
    t.tearDown(function() {
      helper.unloadAgent(agent)
    })
    return agent
  }
})
