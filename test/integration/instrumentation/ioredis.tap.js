'use strict'

var tap = require('tap')
var test = tap.test
var helper = require('../../lib/agent_helper')
var assertMetrics = require('../../lib/metrics_helper').assertMetrics
var params = require('../../lib/params')
var semver = require('semver')


// CONSTANTS
var DB_INDEX = 2


test('ioredis instrumentation', {skip: semver.satisfies(process.version, "<0.10")},
  function(t) {

  t.test('creates expected metrics',
       {timeout : 5000}, function (t) {

    var self = this
    var onError = function(error){return t.fail(error)}

    var name = require.resolve('ioredis')
    name = require.resolve('bluebird')

    setup(t, function runTest(agent, redisClient) {
      agent.on('transactionFinished', function(tx) {
        var expected = [
          [{ name: 'Datastore/all' }],
          [{ name: 'Datastore/Redis/all' }],
          [{ name: 'Datastore/operation/Redis/set' }]
        ]
        assertMetrics(tx.metrics, expected, false, false)
        t.end()
      })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        redisClient.set('testkey', 'testvalue').then(function (ok) {
          transaction.end()
        }, onError).catch(onError)
      })
    })
  })

  t.test('creates expected segments',
       {timeout : 5000}, function (t) {

    var self = this
    var onError = function(error){return t.fail(error)}

    var name = require.resolve('ioredis')
    name = require.resolve('bluebird')

    setup(t, function runTest(agent, redisClient) {
      agent.on('transactionFinished', function(tx) {
        var root = tx.trace.root
        t.equals(root.children.length, 2, 'root has two children')

        var setSegment = root.children[0]
        t.equals(setSegment.name, 'Datastore/operation/Redis/set')

        // ioredis operations return promise, any 'then' callbacks will be sibling segments
        // of the original redis call
        var getSegment = root.children[1]
        t.equals(getSegment.name, 'Datastore/operation/Redis/get')
        t.equals(getSegment.children.length, 0, 'should not contain any segments')

        t.end()
      })

      helper.runInTransaction(agent, function transactionInScope(transaction) {
        var p1 = redisClient.set('testkey', 'testvalue')

        p1.then(function() {
          return redisClient.get('testkey')
        })
        .then(function() {
          transaction.end()
        })
        .catch(onError)
      })
    })
  })
})


function setup(t, callback) {
  helper.bootstrapRedis(DB_INDEX, function cb_bootstrapRedis(error, app) {
    if (error) return t.fail(error)
    var agent = helper.instrumentMockedAgent()

    // remove from cache, so that the bluebird library that ioredis uses gets
    // re-instrumented
    var name = require.resolve('ioredis')
    delete require.cache[name]

    var Redis = require('ioredis')
    var client = new Redis(params.redis_port, params.redis_host)

    t.tearDown(function cb_tearDown() {
      helper.unloadAgent(agent)
      client.disconnect()
    })

    callback(agent, client)
  })
}