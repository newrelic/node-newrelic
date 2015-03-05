'use strict'

var tap = require('tap')
var test = tap.test
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')


// CONSTANTS
var DB_INDEX = 2

test("Redis instrumentation should find Redis calls in the transaction trace",
     {timeout : 5000},
     function (t) {
  t.plan(18)

  var self = this
  helper.bootstrapRedis(DB_INDEX, function cb_bootstrapRedis(error, app) {
    if (error) return t.fail(error)
    var agent = helper.instrumentMockedAgent()
    var redis = require('redis')
    var client = redis.createClient(params.redis_port, params.redis_host)


    self.tearDown(function cb_tearDown() {
      helper.unloadAgent(agent)
    })

    // need to capture parameters
    agent.config.capture_params = true

    t.notOk(agent.getTransaction(), "no transaction should be in play")

    helper.runInTransaction(agent, function transactionInScope() {
      var transaction = agent.getTransaction()
      t.ok(transaction, "transaction should be visible")

      client.set('testkey', 'arglbargle', function (error, ok) {
        if (error) return t.fail(error)

        t.ok(agent.getTransaction(), "transaction should still be visible")
        t.ok(ok, "everything should be peachy after setting")

        client.get('testkey', function (error, value) {
          if (error) return t.fail(error)

          t.ok(agent.getTransaction(), "transaction should still still be visible")
          t.equals(value, 'arglbargle', "memcached client should still work")

          var trace = transaction.trace
          t.ok(trace, "trace should exist")
          t.ok(trace.root, "root element should exist")
          t.equals(trace.root.children.length, 1,
                   "there should be only one child of the root")

          var setSegment = trace.root.children[0]
          t.ok(setSegment, "trace segment for set should exist")
          t.equals(setSegment.name, "Datastore/operation/Redis/set",
                   "should register the set")
          t.equals(setSegment.parameters.key, "\"testkey\"",
                   "should have the set key as a parameter")
          t.equals(setSegment.children.length, 1,
                   "set should have an only child")

          var getSegment = setSegment.children[0].children[0]
          t.ok(getSegment, "trace segment for get should exist")
          t.equals(getSegment.name, "Datastore/operation/Redis/get",
                   "should register the get")
          t.equals(getSegment.parameters.key, "\"testkey\"",
                   "should have the get key as a parameter")
          t.ok(getSegment.children.length >= 1,
                   "get should have a callback segment")
          t.ok(getSegment.timer.hrDuration, "trace segment should have ended")

          transaction.end(function() {
            client.end()
          })
        })
      })
    })
  })
})
