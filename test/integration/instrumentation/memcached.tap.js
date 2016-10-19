'use strict'

var tap = require('tap')
var test = tap.test
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')
var urltils = require('../../../lib/util/urltils')

test("memcached instrumentation should find memcached calls in the transaction trace",
     {timeout : 5000},
     function(t) {
  t.plan(41)

  helper.bootstrapMemcached(function cb_bootstrapMemcached(error) {
    if (error) return t.fail(error)

    var agent = helper.instrumentMockedAgent()
    var Memcached = require('memcached')

    var memcached = new Memcached(params.memcached_host + ':' + params.memcached_port)

    // need to capture parameters
    agent.config.capture_params = true

    t.tearDown(function cb_tearDown() {
      memcached.end()
      helper.unloadAgent(agent)
    })

    t.notOk(agent.getTransaction(), "no transaction should be in play")

    helper.runInTransaction(agent, function transactionInScope() {
      var transaction = agent.getTransaction()
      t.ok(transaction, "transaction should be visible")

      memcached.set('testkey', 'arglbargle', 1000, function (error, ok) {
        if (error) return t.fail(error)

        t.ok(agent.getTransaction(), "transaction should still be visible")
        t.ok(ok, "everything should be peachy after setting")

        memcached.get('testkey', function (error, value) {
          if (error) return t.fail(error)

          t.ok(agent.getTransaction(), "transaction should still still be visible")
          t.equals(value, 'arglbargle', "memcached client should still work")

          transaction.end()

          var trace = transaction.trace
          t.ok(trace, "trace should exist")
          t.ok(trace.root, "root element should exist")
          t.equals(trace.root.children.length, 1,
                   "there should be only one child of the root")

          var setSegment = trace.root.children[0]
          var segParams = setSegment.parameters
          t.equals(
            segParams.host,
            getMetricHostName(agent, 'memcached'),
            'should collect host instance parameters'
          )
          t.equals(
            segParams.port_path_or_id,
            String(params.memcached_port),
            'should collect port instance parameters'
          )
          t.ok(setSegment, "trace segment for set should exist")
          t.equals(setSegment.name, "Datastore/operation/Memcache/set",
                   "should register the set")
          t.equals(setSegment.parameters.key, "\"testkey\"",
                   "should have the set key as a parameter")
          t.ok(setSegment.children.length >= 1, "set should have a callback segment")

          var getSegment = setSegment.children[1].children[0]
          segParams = getSegment.parameters
          t.equals(
            segParams.host,
            getMetricHostName(agent, 'memcached'),
            'should collect host instance parameters'
          )
          t.equals(
            segParams.port_path_or_id,
            String(params.memcached_port),
            'should collect port instance parameters'
          )
          t.ok(getSegment, "trace segment for get should exist")
          t.equals(getSegment.name, "Datastore/operation/Memcache/get",
                   "should register the get")
          t.equals(getSegment.parameters.key, "\"testkey\"",
                   "should have the get key as a parameter")
          t.ok(getSegment.children.length >= 1,
                   "get should leave us here at the end")
        })
      })
    })

    t.notOk(agent.getTransaction(), "no transaction should be in play")

    helper.runInTransaction(agent, function transactionInScope() {
      var transaction = agent.getTransaction()

      memcached.set('otherkey', 'blerg', 1000, function (error, ok) {
        if (error) return t.fail(error)

        t.ok(ok, "everything should still be peachy after setting again")

        memcached.getMulti(['testkey', 'otherkey'], function (error, values) {
          if (error) return t.fail(error)

          t.deepEquals(values, {testkey : 'arglbargle', otherkey : 'blerg'},
                       "memcached client should still work")

          transaction.end()

          var trace = transaction.trace
          t.ok(trace, "trace should exist")
          t.ok(trace.root, "root element should exist")
          t.equals(trace.root.children.length, 1,
                   "there should be only one child of the root")

          var setSegment = trace.root.children[0]
          var segParams = setSegment.parameters
          t.equals(
            segParams.host,
            getMetricHostName(agent, 'memcached'),
            'should collect host instance parameters'
          )
          t.equals(
            segParams.port_path_or_id,
            String(params.memcached_port),
            'should collect port instance parameters'
          )
          t.equals(setSegment.name, "Datastore/operation/Memcache/set",
                   "should register the set")
          t.equals(setSegment.parameters.key, "\"otherkey\"",
                   "should have the set key as a parameter")
          t.ok(setSegment.children.length >= 1,
                   "set should have a callback segment")

          var getSegment = setSegment.children[1].children[0]
          segParams = getSegment.parameters
          t.equals(
            segParams.host,
            getMetricHostName(agent, 'memcached'),
            'should collect host instance parameters'
          )
          t.equals(
            segParams.port_path_or_id,
            String(params.memcached_port),
            'should collect port instance parameters'
          )
          t.equals(getSegment.name, "Datastore/operation/Memcache/get",
                   "should register the get")
          t.equals(getSegment.parameters.key, "[\"testkey\",\"otherkey\"]",
                   "should have the multiple keys fetched as a parameter")
          t.ok(
            getSegment.children.length >= 1,
            "get should have a callback segment"
          )
        })
      })
    })

    t.notOk(agent.getTransaction(), "no transaction should be in play")

    // memcached.version() is one of the calls that gets the second argument to
    // command.
    helper.runInTransaction(agent, function transactionInScope() {
      t.ok(agent.getTransaction(), 'new transaction started')

      memcached.version(function (error, ok) {
        t.notOk(error, 'version should not throw an error')
        t.ok(ok, 'got a version')
      })
    })
  })
})

// XXX this should go in a util
function getMetricHostName(agent, db) {
  return urltils.isLocalhost(params[db + '_host'])
    ? agent.config.getHostnameSafe()
    : params.postgres_host
}
