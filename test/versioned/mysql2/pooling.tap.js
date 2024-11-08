/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const logger = require('../../../lib/logger')
const helper = require('../../lib/agent_helper')
const setup = require('./setup')

const { DATABASE, TABLE } = setup

tap.test('MySQL2 instrumentation with a connection pool', { timeout: 60000 }, function (t) {
  // set up the instrumentation before loading MySQL
  const poolLogger = logger.child({ component: 'pool' })
  const agent = helper.instrumentMockedAgent()
  const mysql = require('mysql2')
  const pool = setup.pool(mysql, poolLogger)

  t.teardown(function () {
    pool.drain(function () {
      pool.destroyAllNow()
      helper.unloadAgent(agent)
    })
  })

  const withRetry = {
    getClient: function (callback, counter) {
      if (!counter) {
        counter = 1
      }
      counter++

      pool.acquire(function (err, client) {
        if (err) {
          poolLogger.error('Failed to get connection from the pool: %s', err)

          if (counter < 10) {
            pool.destroy(client)
            this.getClient(callback, counter)
          } else {
            return callback(new Error("Couldn't connect to DB after 10 attempts."))
          }
        } else {
          callback(null, client)
        }
      })
    },

    release: function (client) {
      pool.release(client)
    }
  }

  const dal = {
    lookup: function (params, callback) {
      if (!params.id) {
        return callback(new Error('Must include ID to look up.'))
      }

      withRetry.getClient((err, client) => {
        if (err) {
          return callback(err)
        }

        const query = 'SELECT *' + '  FROM ' + DATABASE + '.' + TABLE + ' WHERE id = ?'
        client.query(query, [params.id], function (err, results) {
          withRetry.release(client) // always release back to the pool

          if (err) {
            return callback(err)
          }

          callback(null, results.length ? results[0] : results)
        })
      })
    }
  }

  setup(mysql).then(() => {
    t.notOk(agent.getTransaction(), 'no transaction should be in play yet')
    helper.runInTransaction(agent, function transactionInScope() {
      dal.lookup({ id: 1 }, function (error, row) {
        if (error) {
          t.fail(error)
        }

        // need to inspect on next tick, otherwise calling transaction.end() here
        // in the callback (which is its own segment) would mark it as truncated
        // (since it has not finished executing)
        setImmediate(inspect, row)
      })
    })

    function inspect(row) {
      const transaction = agent.getTransaction()
      if (!transaction) {
        t.fail('transaction should be visible')
        return t.end()
      }

      t.equal(row.id, 1, 'mysql2 should still work (found id)')
      t.equal(row.test_value, 'hamburgefontstiv', 'mysql driver should still work (found value)')

      transaction.end()

      const trace = transaction.trace
      t.ok(trace, 'trace should exist')
      t.ok(trace.root, 'root element should exist.')
      const children = trace.getChildren(trace.root.id)
      t.equal(children.length, 1, 'There should be only one child.')

      const selectSegment = children[0]
      t.ok(selectSegment, 'trace segment for first SELECT should exist')
      t.equal(
        selectSegment.name,
        `Datastore/statement/MySQL/${DATABASE}.${TABLE}/select`,
        'should register as SELECT'
      )

      const selectChildren = trace.getChildren(selectSegment.id)
      t.equal(selectChildren.length, 1, 'should only have a callback segment')
      const cb = selectChildren[0]
      t.equal(cb.name, 'Callback: <anonymous>')
      const cbChildren = trace.getChildren(cb.id)

      cbChildren
        .map(function (segment) {
          return segment.name
        })
        .forEach(function (segmentName) {
          if (
            segmentName !== 'timers.setTimeout' &&
            segmentName !== 'Truncated/timers.setTimeout'
          ) {
            t.fail('callback segment should have only timeout children')
          }
        })
      t.end()
    }
  })
})
