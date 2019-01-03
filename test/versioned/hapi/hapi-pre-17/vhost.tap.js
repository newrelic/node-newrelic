'use strict'

var DESTINATIONS = require('../../../../lib/config/attribute-filter').DESTINATIONS
var tap = require('tap')
var request = require('request')
var helper = require('../../../lib/agent_helper')
var utils = require('./hapi-utils')
var HTTP_ATTS = require('../../../lib/fixtures').httpAttributes

tap.test('Hapi vhost support', function(t) {
  t.plan(1)

  var port = null

  t.test('should not explode when using vhosts', function(t) {
    const agent = helper.instrumentMockedAgent()
    const server = utils.getServer()

    // disabled by default
    agent.config.attributes.enabled = true

    t.tearDown(function() {
      server.stop(function() {
        helper.unloadAgent(agent)
      })
    })

    agent.on('transactionFinished', function(tx) {
      t.ok(tx.trace, 'transaction has a trace.')
      var attributes = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      HTTP_ATTS.forEach(function(key) {
        t.ok(attributes[key], 'Trace contains expected HTTP attribute: ' + key)
      })
    })

    server.route({
      method: 'GET',
      path: '/test/',
      vhost: 'localhost',
      handler: function(req, reply) {
        t.ok(agent.getTransaction(), 'transaction is available')
        reply({status: 'ok'})
      }
    })

    server.route({
      method: 'GET',
      path: '/test/2',
      vhost: 'localhost',
      handler: function(req, reply) {
        t.ok(agent.getTransaction(), 'transaction is available')
        reply({status: 'ok'})
      }
    })

    server.start(function() {
      port = server.info.port
      var params = {
        uri: 'http://localhost:' + port + '/test/2',
        json: true
      }
      request.get(params, function(error, res, body) {
        t.equal(res.statusCode, 200, 'nothing exploded')
        t.deepEqual(body, {status: 'ok'}, 'got expected response')
        t.end()
      })
    })
  })
})
