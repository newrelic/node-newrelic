/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const setup = require('./setup')
const { tspl } = require('@matteo.collina/tspl')

module.exports = function ({ factory, constants }) {
  const { USER, DATABASE, TABLE } = constants
  test('MySQL transactions', { timeout: 30000 }, async function (t) {
    const plan = tspl(t, { plan: 6 })
    // set up the instrumentation before loading MySQL
    const agent = helper.instrumentMockedAgent()
    const mysql = factory()

    await setup(USER, DATABASE, TABLE, mysql)
    const client = mysql.createConnection({
      user: USER,
      database: DATABASE,
      host: params.mysql_host,
      port: params.mysql_port
    })

    t.after(function () {
      helper.unloadAgent(agent)
      client.end()
    })

    plan.ok(!agent.getTransaction(), 'no transaction should be in play yet')
    helper.runInTransaction(agent, async function transactionInScope() {
      plan.ok(agent.getTransaction(), 'we should be in a transaction')
      client.beginTransaction(function (err) {
        plan.ok(!err)
        // trying the object mode of client.query
        client.query({ sql: 'SELECT 1', timeout: 2000 }, function (err) {
          plan.ok(!err)
          client.commit(function (err) {
            plan.ok(!err)
            plan.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
          })
        })
      })
    })
    await plan.completed
  })
}
