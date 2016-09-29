'use strict'

var tap = require('tap')
var test = tap.test
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')
var urltils = require('../../../lib/util/urltils')


// CONSTANTS
var DB_INDEX = 2

test('Redis instrumentation', {timeout : 5000}, function(t) {
  var METRIC_HOST_NAME = null
  var HOST_ID = null

  // Prepare redis.
  helper.bootstrapRedis(DB_INDEX, function cb_bootstrapRedis(error) {
    if (error) return t.fail(error)
    var agent = helper.instrumentMockedAgent()
    var redis = require('redis')
    var client = redis.createClient(params.redis_port, params.redis_host)

    METRIC_HOST_NAME = urltils.isLocalhost(params.redis_host)
      ? agent.config.getHostnameSafe()
      : params.redis_host
    HOST_ID = METRIC_HOST_NAME + ':' + params.redis_port

    t.tearDown(function cb_tearDown() {
      client.end({flush: false})
      helper.unloadAgent(agent)
    })

    // need to capture parameters
    agent.config.capture_params = true

    // Start testing!
    t.autoend()
    t.notOk(agent.getTransaction(), "no transaction should be in play")
    t.test('should find Redis calls in the transaction trace', function(t) {
      setGetTest(t, agent, client)
    })
    t.test('should follow selected database', function(t) {
      selectTest(t, agent, client)
    })
  })

  function setGetTest(t, agent, client) {
    helper.runInTransaction(agent, function transactionInScope() {
      var transaction = agent.getTransaction()
      t.ok(transaction, "transaction should be visible")

      client.set('testkey', 'arglbargle', function(error, ok) {
        if (error) return t.fail(error)

        t.ok(agent.getTransaction(), "transaction should still be visible")
        t.ok(ok, "everything should be peachy after setting")

        client.get('testkey', function(error, value) {
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
          t.equals(
            setSegment.name, 'Datastore/operation/Redis/set',
            'should register the set'
          )
          t.equals(
            setSegment.parameters.key, '"testkey"',
            'should have the set key as a parameter'
          )
          t.equals(
            setSegment.parameters.instance, HOST_ID,
            'should have instance id as parameter'
          )
          t.equals(
            setSegment.parameters.database_name, 0,
            'should have database id as parameter'
          )
          t.equals(
            setSegment.children.length, 1,
            'set should have an only child'
          )

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
            var unscoped = transaction.metrics.unscoped
            var expected = {
              'Datastore/all': 2,
              'Datastore/allOther': 2,
              'Datastore/Redis/all': 2,
              'Datastore/Redis/allOther': 2,
              'Datastore/operation/Redis/set': 1,
              'Datastore/operation/Redis/get': 1,
            }
            expected['Datastore/instance/Redis/' + HOST_ID] = 2
            checkMetrics(t, unscoped, expected)

            t.end()
          })
        })
      })
    })
  }

  function selectTest(t, agent, client) {
    var transaction = null
    var SELECTED_DB = 2
    helper.runInTransaction(agent, function(tx) {
      transaction = tx
      client.set('select:test:key', 'foo', function(err) {
        t.notOk(err, 'should not fail to set')
        t.ok(agent.getTransaction(), 'should not lose transaction state')

        client.select(SELECTED_DB, function(err) {
          t.notOk(err, 'should not fail to select')
          t.ok(agent.getTransaction(), 'should not lose transaction state')

          client.set('select:test:key:2', 'bar', function(err) {
            t.notOk(err, 'should not fail to set in db 2')
            t.ok(agent.getTransaction(), 'should not lose transaction state')
            transaction.end(verify)
          })
        })
      })
    })

    function verify() {
      var setSegment1 = transaction.trace.root.children[0]
      var selectSegment = setSegment1.children[0].children[0]
      var setSegment2 = selectSegment.children[0].children[0]

      t.equals(
        setSegment1.name, 'Datastore/operation/Redis/set',
        'should register the first set'
      )
      t.equals(
        setSegment1.parameters.database_name, 0,
        'should have the starting database id as parameter for the first set'
      )
      t.equals(
        selectSegment.name, 'Datastore/operation/Redis/select',
        'should register the select'
      )
      t.equals(
        selectSegment.parameters.database_name, 0,
        'should have the starting database id as parameter for the select'
      )
      t.equals(
        setSegment2.name, 'Datastore/operation/Redis/set',
        'should register the second set'
      )
      t.equals(
        setSegment2.parameters.database_name, SELECTED_DB,
        'should have the selected database id as parameter for the second set'
      )

      t.end()
    }
  }
})

function checkMetrics(t, metrics, expected) {
  Object.keys(expected).forEach(function(name) {
    t.ok(metrics[name], 'should have metric ' + name)
    if (metrics[name]) {
      t.equals(
        metrics[name].callCount, expected[name],
        'should have ' + expected[name] + ' calls for ' + name
      )
    }
  })
}
