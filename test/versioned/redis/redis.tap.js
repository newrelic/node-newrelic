/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var tap = require('tap')
var test = tap.test
var helper = require('../../lib/agent_helper')
var params = require('../../lib/params')
var urltils = require('../../../lib/util/urltils')


// CONSTANTS
var DB_INDEX = 2

test('Redis instrumentation', {timeout : 10000}, function(t) {
  t.autoend()

  var METRIC_HOST_NAME = null
  var HOST_ID = null

  var agent
  var client

  t.beforeEach(function(done) {
    helper.bootstrapRedis(DB_INDEX, function cb_bootstrapRedis(error) {
      if (error) {
        return t.fail(error)
      }

      agent = helper.instrumentMockedAgent()

      const redis = require('redis')
      client = redis.createClient(params.redis_port, params.redis_host)
      client.once('ready', () => {
        client.select(DB_INDEX, function(err) {
          METRIC_HOST_NAME = urltils.isLocalhost(params.redis_host)
            ? agent.config.getHostnameSafe()
            : params.redis_host
          HOST_ID = METRIC_HOST_NAME + '/' + params.redis_port

          // need to capture attributes
          agent.config.attributes.enabled = true

          // Start testing!
          t.notOk(agent.getTransaction(), "no transaction should be in play")
          done(err)
        })
      })
    })
  })

  t.afterEach(function(done) {
    client.end({flush: false})
    helper.unloadAgent(agent)
    done()
  })

  t.test('should find Redis calls in the transaction trace', function(t) {
    t.plan(17)
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
          t.equals(
            trace.root.children.length, 1,
            "there should be only one child of the root"
          )

          var setSegment = trace.root.children[0]
          const setAttributes = setSegment.getAttributes()
          t.ok(setSegment, "trace segment for set should exist")
          t.equals(
            setSegment.name, 'Datastore/operation/Redis/set',
            'should register the set'
          )
          t.equals(
            setAttributes.key, '"testkey"',
            'should have the set key as a attribute'
          )
          t.equals(
            setSegment.children.length, 1,
            'set should have an only child'
          )

          var getSegment = setSegment.children[0].children[0]
          const getAttributes = getSegment.getAttributes()
          t.ok(getSegment, "trace segment for get should exist")

          t.equals(
            getSegment.name,
            "Datastore/operation/Redis/get",
            "should register the get"
          )

          t.equals(
            getAttributes.key,
            "\"testkey\"",
            "should have the get key as a attribute"
          )

          t.ok(
            getSegment.children.length >= 1,
            "get should have a callback segment"
          )

          t.ok(getSegment.timer.hrDuration, "trace segment should have ended")
        })
      })
    })
  })

  t.test('when called without a callback', function(t) {
    t.plan(4)

    let transaction = null

    helper.runInTransaction(agent, function(tx) {
      transaction = tx

      client.set('testKey', 'testvalue')

      triggerError()

      function triggerError() {
        // When the redis service responds, the command is dequeued and then
        // the command callback is executed, if exists. Since we don't have a callback,
        // we wait for the command to be removed from the queue.
        if (client.commandQueueLength > 0) {
          t.comment('set command still in command queue. scheduling retry')

          setTimeout(triggerError, 100)
          return
        }

        // This will generate an error because `testKey` is not a hash.
        client.hset('testKey', 'hashKey', 'foobar')
      }
    })

    client.on('error', function(err) {
      if (t.ok(err, 'should emit errors on the client')) {
        t.equal(
          err.message,
          'WRONGTYPE Operation against a key holding the wrong kind of value',
          'errors should have the expected error message'
        )

        // Ensure error triggering operation has completed before
        // continuing test assertions.
        transaction.end()
      }
    })

    agent.on('transactionFinished', function(tx) {
      var redSeg = tx.trace.root.children[0]
      t.equal(
        redSeg.name, 'Datastore/operation/Redis/set',
        'should have untruncated redis segment'
      )
      t.equal(redSeg.children.length, 0, 'should have no children for redis segment')
    })
  })

  t.test('should create correct metrics', function(t) {
    t.plan(14)
    helper.runInTransaction(agent, function transactionInScope() {
      var transaction = agent.getTransaction()
      client.set('testkey', 'arglbargle', function(error) {
        if (error) return t.fail(error)

        client.get('testkey', function(error) {
          if (error) return t.fail(error)

          transaction.end()
          var unscoped = transaction.metrics.unscoped
          var expected = {
            'Datastore/all': 2,
            'Datastore/allWeb': 2,
            'Datastore/Redis/all': 2,
            'Datastore/Redis/allWeb': 2,
            'Datastore/operation/Redis/set': 1,
            'Datastore/operation/Redis/get': 1,
          }
          expected['Datastore/instance/Redis/' + HOST_ID] = 2
          checkMetrics(t, unscoped, expected)
        })
      })
    })
  })

  t.test('should add `key` attribute to trace segment', function(t) {
    agent.config.attributes.enabled = true

    helper.runInTransaction(agent, function() {
      client.set('saveme', 'foobar', function(error) {
        // Regardless of error, key should still be captured.
        t.error(error)

        var segment = agent.tracer.getSegment().parent
        t.equals(segment.getAttributes().key, '"saveme"', 'should have `key` attribute')
        t.end()
      })
    })
  })

  t.test('should not add `key` attribute to trace segment', function(t) {
    agent.config.attributes.enabled = false

    helper.runInTransaction(agent, function() {
      client.set('saveme', 'foobar', function(error) {
        // Regardless of error, key should still be captured.
        t.error(error)

        var segment = agent.tracer.getSegment().parent
        t.notOk(segment.getAttributes().key, 'should not have `key` attribute')
        t.end()
      })
    })
  })

  t.test('should add datastore instance attributes to trace segments', function(t) {
    t.plan(4)

    // Enable.
    agent.config.datastore_tracer.instance_reporting.enabled = true
    agent.config.datastore_tracer.database_name_reporting.enabled = true

    helper.runInTransaction(agent, function transactionInScope() {
      var transaction = agent.getTransaction()
      client.set('testkey', 'arglbargle', function(error) {
        if (error) return t.fail(error)

        var trace = transaction.trace
        var setSegment = trace.root.children[0]
        const attributes = setSegment.getAttributes()
        t.equals(
          attributes.host, METRIC_HOST_NAME,
          'should have host as attribute'
        )
        t.equals(
          attributes.port_path_or_id, String(params.redis_port),
          'should have port as attribute'
        )
        t.equals(
          attributes.database_name, String(DB_INDEX),
          'should have database id as attribute'
        )
        t.equals(
          attributes.product, 'Redis',
          'should have product attribute'
        )
      })
    })
  })

  t.test('should not add instance attributes/metrics when disabled', function(t) {
    t.plan(5)

    // disable
    agent.config.datastore_tracer.instance_reporting.enabled = false
    agent.config.datastore_tracer.database_name_reporting.enabled = false

    helper.runInTransaction(agent, function transactionInScope() {
      var transaction = agent.getTransaction()
      client.set('testkey', 'arglbargle', function(error) {
        if (!t.error(error)) {
          return t.end()
        }

        var setSegment = transaction.trace.root.children[0]
        const attributes = setSegment.getAttributes()
        t.equals(
          attributes.host, undefined,
          'should not have host attribute'
        )
        t.equals(
          attributes.port_path_or_id, undefined,
          'should not have port attribute'
        )
        t.equals(
          attributes.database_name, undefined,
          'should not have db name attribute'
        )

        transaction.end()
        var unscoped = transaction.metrics.unscoped
        t.equals(
          unscoped['Datastore/instance/Redis/' + HOST_ID], undefined,
          'should not have instance metric')
      })
    })
  })

  t.test('should follow selected database', function(t) {
    t.plan(12)
    var transaction = null
    var SELECTED_DB = 3
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
            transaction.end()
            verify(transaction)
          })
        })
      })
    })

    function verify() {
      var setSegment1 = transaction.trace.root.children[0]
      var selectSegment = setSegment1.children[0].children[0]
      var setSegment2 = selectSegment.children[0].children[0]

      t.equals(
        setSegment1.name,
        'Datastore/operation/Redis/set',
        'should register the first set'
      )
      t.equals(
        setSegment1.getAttributes().database_name,
        String(DB_INDEX),
        'should have the starting database id as attribute for the first set'
      )
      t.equals(
        selectSegment.name,
        'Datastore/operation/Redis/select',
        'should register the select'
      )
      t.equals(
        selectSegment.getAttributes().database_name,
        String(DB_INDEX),
        'should have the starting database id as attribute for the select'
      )
      t.equals(
        setSegment2.name,
        'Datastore/operation/Redis/set',
        'should register the second set'
      )
      t.equals(
        setSegment2.getAttributes().database_name, String(SELECTED_DB),
        'should have the selected database id as attribute for the second set'
      )
    }
  })
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
