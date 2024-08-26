/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../../lib/agent_helper')

test('Domains', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.tasks = []
    ctx.nr.agent = helper.instrumentMockedAgent()

    // Starting on 9.3.0, calling `domain.exit` does not stop assertions in later
    // tests from being caught in this domain. In order to get around that we
    // are breaking out of the domain via a manual tasks queue.
    ctx.nr.interval = setInterval(function () {
      while (ctx.nr.tasks.length) {
        ctx.nr.tasks.pop()()
      }
    }, 10)
  })

  t.afterEach((ctx) => {
    clearInterval(ctx.nr.interval)
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should not be loaded just from loading the agent', (t, end) => {
    assert.ok(!process.domain)
    end()
  })

  await t.test('should retain transaction scope on error events', (t, end) => {
    const { agent, tasks } = t.nr
    // eslint-disable-next-line node/no-deprecated-api
    const domain = require('domain')
    const d = domain.create()

    t.after(() => {
      d.exit()
    })

    let checkedTransaction = null
    d.once('error', function (err) {
      assert.ok(err)
      assert.equal(err.message, 'whole new error!')

      const transaction = agent.getTransaction()
      assert.equal(transaction.id, checkedTransaction.id)
      tasks.push(end)
    })

    helper.runInTransaction(agent, function (transaction) {
      checkedTransaction = transaction
      d.run(function () {
        setTimeout(function () {
          throw new Error('whole new error!')
        }, 50)
      })
    })
  })
})
