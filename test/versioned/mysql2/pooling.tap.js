'use strict'

var tap = require('tap')
var logger = require('../../../lib/logger')
var helper = require('../../lib/agent_helper')
var setup = require('./setup')

var DBNAME = 'agent_integration'
var DBTABLE = 'test'

tap.test('MySQL2 instrumentation with a connection pool', {timeout: 30000}, function(t) {
  // set up the instrumentation before loading MySQL
  var poolLogger = logger.child({component: 'pool'})
  var agent = helper.instrumentMockedAgent()
  var mysql = require('mysql2')
  var pool = setup.pool(mysql, poolLogger)

  t.tearDown(function() {
    pool.drain(function() {
      pool.destroyAllNow()
      helper.unloadAgent(agent)
    })
  })

  var withRetry = {
    getClient : function(callback, counter) {
      if (!counter) counter = 1
      counter++

      pool.acquire(function(err, client) {
        if (err) {
          poolLogger.error('Failed to get connection from the pool: %s', err)

          if (counter < 10) {
            pool.destroy(client)
            withRetry.getClient(callback, counter)
          } else {
            return callback(new Error('Couldn\'t connect to DB after 10 attempts.'))
          }
        } else {
          callback(null, client)
        }
      })
    },

    release: function(client) {
      pool.release(client)
    }
  }

  var dal = {
    lookup: function(params, callback) {
      if (!params.id) return callback(new Error('Must include ID to look up.'))

      withRetry.getClient(function cb_getClient(err, client) {
        if (err) return callback(err)

        var query = 'SELECT *' +
                    '  FROM ' + DBNAME + '.' + DBTABLE +
                    ' WHERE id = ?'
        client.query(query, [params.id], function(err, results) {
          withRetry.release(client) // always release back to the pool

          if (err) return callback(err)

          callback(null, results.length ? results[0] : results)
        })
      })
    }
  }

  setup(mysql, function(err) {
    t.error(err, 'should not error setting up test')
    t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
    helper.runInTransaction(agent, function transactionInScope() {
      dal.lookup({id: 1}, function(error, row) {
        if (error) t.fail(error)

        // need to inspect on next tick, otherwise calling transaction.end() here
        // in the callback (which is its own segment) would mark it as truncated
        // (since it has not finished executing)
        setImmediate(inspect, row)
      })
    })

    function inspect(row) {
      var transaction = agent.getTransaction()
      if (!transaction) {
        t.fail('transaction should be visible')
        return t.end()
      }

      t.equals(row.id, 1, 'mysql2 should still work (found id)')
      t.equals(
        row.test_value,
        'hamburgefontstiv',
        'mysql driver should still work (found value)'
      )

      transaction.end()

      var trace = transaction.trace
      t.ok(trace, 'trace should exist')
      t.ok(trace.root, 'root element should exist.')
      t.equals(trace.root.children.length, 1, 'There should be only one child.')

      var selectSegment = trace.root.children[0]
      t.ok(selectSegment, 'trace segment for first SELECT should exist')
      t.equals(
        selectSegment.name,
        'Datastore/statement/MySQL/agent_integration.test/select',
        'should register as SELECT'
      )

      t.equals(selectSegment.children.length, 1, 'should only have a callback segment')
      t.equals(selectSegment.children[0].name, 'Callback: <anonymous>')

      selectSegment.children[0].children
        .map(function(segment) {return segment.name})
        .forEach(function(segmentName) {
          if (segmentName !== 'timers.setTimeout'
              && segmentName !== 'Truncated/timers.setTimeout') {
            t.fail('callback segment should have only timeout children')
          }
        })
      t.end()
    }
  })
})
