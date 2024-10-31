/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const logger = require('../../../lib/logger')
const helper = require('../../lib/agent_helper')
const setup = require('./setup')
const { lookup } = require('./utils')

module.exports = function ({ factory, poolFactory, constants }) {
  const { USER, DATABASE, TABLE } = constants
  test('MySQL instrumentation with a connection pool', { timeout: 30000 }, async function (t) {
    const plan = tspl(t, { plan: 13 })
    const poolLogger = logger.child({ component: 'pool' })
    const agent = helper.instrumentMockedAgent()
    const mysql = factory()
    const genericPool = poolFactory()
    const pool = setup.pool(USER, DATABASE, mysql, genericPool, poolLogger)

    t.after(function () {
      pool.drain(function () {
        pool.destroyAllNow()
        helper.unloadAgent(agent)
      })
    })

    await setup(USER, DATABASE, TABLE, mysql)
    plan.ok(!agent.getTransaction(), 'no transaction should be in play yet')
    await helper.runInTransaction(agent, async function transactionInScope() {
      const params = {
        id: 1
      }
      lookup({ pool, params, database: DATABASE, table: TABLE }, function tester(error, row) {
        plan.ok(!error)
        // need to inspect on next tick, otherwise calling transaction.end() here
        // in the callback (which is its own segment) would mark it as truncated
        // (since it has not finished executing)
        setImmediate(inspect, row)
      })
    })

    await plan.completed

    function inspect(row) {
      const transaction = agent.getTransaction()
      plan.ok(transaction, 'transaction should be visible')
      plan.equal(row.id, 1, 'node-mysql should still work (found id)')
      plan.equal(row.test_value, 'hamburgefontstiv', 'mysql driver should still work (found value)')
      transaction.end()
      const trace = transaction.trace
      plan.ok(trace, 'trace should exist')
      plan.ok(trace.root, 'root element should exist.')
      const children = trace.getChildren(trace.root.id)
      plan.equal(children.length, 1, 'There should be only one child.')

      const selectSegment = children[0]
      plan.ok(selectSegment, 'trace segment for first SELECT should exist')

      plan.equal(
        selectSegment.name,
        `Datastore/statement/MySQL/${DATABASE}.${TABLE}/select`,
        'should register as SELECT'
      )

      const selectChildren = trace.getChildren(selectSegment.id)
      plan.equal(selectChildren.length, 1, 'should only have a callback segment')
      const cb = selectChildren[0]
      plan.equal(cb.name, 'Callback: <anonymous>')
      const cbChildren = trace.getChildren(cb.id)
      plan.equal(cbChildren.length, 0)
    }
  })
}
