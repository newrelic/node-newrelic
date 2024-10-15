/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const Segment = require('../../../lib/transaction/trace/segment')
const Transaction = require('../../../lib/transaction')

const notRunningStates = ['stopped', 'stopping', 'errored']
function beforeEach(ctx) {
  ctx.nr = {}
  const agent = helper.loadMockedAgent()
  ctx.nr.tracer = agent.tracer
  ctx.nr.agent = agent
}

function afterEach(ctx) {
  helper.unloadAgent(ctx.nr.agent)
}

test('Tracer', async function (t) {
  await t.test('#transactionProxy', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should create transaction', (t, end) => {
      const { tracer } = t.nr
      const wrapped = tracer.transactionProxy(() => {
        const transaction = tracer.getTransaction()
        assert.ok(transaction)
        end()
      })

      wrapped()
    })

    await t.test('should not try to wrap a null handler', function (t) {
      const { tracer } = t.nr
      assert.equal(tracer.transactionProxy(null), null)
    })

    for (const agentState of notRunningStates) {
      await t.test(`should not create transaction when agent state is ${agentState}`, (t) => {
        const { tracer, agent } = t.nr
        agent.setState(agentState)

        const wrapped = tracer.transactionProxy(() => {
          const transaction = tracer.getTransaction()
          assert.ok(!transaction)
        })

        wrapped()
      })
    }
  })

  await t.test('#transactionNestProxy', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should create transaction', (t) => {
      const { tracer } = t.nr
      const wrapped = tracer.transactionNestProxy('web', () => {
        const transaction = tracer.getTransaction()
        assert.ok(transaction)
      })

      wrapped()
    })

    for (const agentState of notRunningStates) {
      await t.test(`should not create transaction when agent state is ${agentState}`, (t) => {
        const { tracer, agent } = t.nr
        agent.setState(agentState)

        const wrapped = tracer.transactionNestProxy('web', () => {
          const transaction = tracer.getTransaction()
          assert.ok(!transaction)
        })

        wrapped()
      })
    }

    await t.test(
      'when proxying a trace segment should not try to wrap a null handler',
      function (t, end) {
        const { tracer, agent } = t.nr
        helper.runInTransaction(agent, function () {
          assert.equal(tracer.wrapFunction('123', null, null), null)
          end()
        })
      }
    )

    await t.test(
      'when proxying a callback should not try to wrap a null handler',
      function (t, end) {
        const { tracer, agent } = t.nr
        helper.runInTransaction(agent, function () {
          assert.equal(tracer.bindFunction(null), null)
          end()
        })
      }
    )

    await t.test(
      'when handling immutable errors should not break in annotation process',
      function (t, end) {
        const expectErrMsg = 'FIREBOMB'
        const { tracer, agent } = t.nr
        helper.runInTransaction(agent, function (trans) {
          function wrapMe() {
            const err = new Error(expectErrMsg)
            Object.freeze(err)
            throw err
          }

          assert.throws(() => {
            const fn = tracer.bindFunction(wrapMe, new Segment(trans, 'name'))
            fn()
          }, /Error: FIREBOMB/)
          end()
        })
      }
    )

    await t.test(
      'when a transaction is created inside a transaction should reuse the existing transaction instead of nesting',
      function (t, end) {
        const { agent } = t.nr
        helper.runInTransaction(agent, function (outerTransaction) {
          const outerId = outerTransaction.id
          helper.runInTransaction(agent, function (innerTransaction) {
            const innerId = innerTransaction.id

            assert.equal(innerId, outerId)
            end()
          })
        })
      }
    )
  })

  await t.test('Optional callback', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should call an optional callback function', (t, end) => {
      const { tracer, agent } = t.nr
      const trans = new Transaction(agent)
      const trace = trans.trace

      assert.doesNotThrow(function noCallback() {
        trace.add('UnitTest', null, null) // eslint-disable-line no-new
      })

      const working = trace.add('UnitTest', function () {
        end()
      }, null, false, function (){})

      working.end()
      trans.end()
    })

    await t.test('accepts a callback that records metrics for this segment', (t, end) => {
      const { agent } = t.nr
      const trans = new Transaction(agent)
      const trace = trans.trace

      const segment = trace.add('Test', (insider) => {
        assert.equal(insider, segment)
        end()
      }, null, false, function (){})
      segment.end()
      trans.end()
    })
  })
})
