/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const helper = require('../lib/agent_helper')
const Segment = require('../../lib/transaction/trace/segment')

const notRunningStates = ['stopped', 'stopping', 'errored']
function beforeEach(t) {
  const agent = helper.loadMockedAgent()
  t.context.tracer = agent.tracer
  t.context.agent = agent
}

function afterEach(t) {
  helper.unloadAgent(t.context.agent)
}

tap.test('Tracer', function (t) {
  t.autoend()

  t.test('#transactionProxy', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should create transaction', (t) => {
      const { tracer } = t.context
      const wrapped = tracer.transactionProxy(() => {
        const transaction = tracer.getTransaction()
        t.ok(transaction)
        t.end()
      })

      wrapped()
    })

    t.test('should not try to wrap a null handler', function (t) {
      const { tracer } = t.context
      t.equal(tracer.transactionProxy(null), null)
      t.end()
    })

    notRunningStates.forEach((agentState) => {
      t.test(`should not create transaction when agent state is ${agentState}`, (t) => {
        const { tracer, agent } = t.context
        agent.setState(agentState)

        const wrapped = tracer.transactionProxy(() => {
          const transaction = tracer.getTransaction()
          t.notOk(transaction)
        })

        wrapped()
        t.end()
      })
    })
  })

  t.test('#transactionNestProxy', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should create transaction', (t) => {
      const { tracer } = t.context
      const wrapped = tracer.transactionNestProxy('web', () => {
        const transaction = tracer.getTransaction()
        t.ok(transaction)
      })

      wrapped()
      t.end()
    })

    notRunningStates.forEach((agentState) => {
      t.test(`should not create transaction when agent state is ${agentState}`, (t) => {
        const { tracer, agent } = t.context
        agent.setState(agentState)

        const wrapped = tracer.transactionNestProxy('web', () => {
          const transaction = tracer.getTransaction()
          t.notOk(transaction)
        })

        wrapped()
        t.end()
      })
    })

    t.test('when proxying a trace segment should not try to wrap a null handler', function (t) {
      const { tracer, agent } = t.context
      helper.runInTransaction(agent, function () {
        t.equal(tracer.wrapFunction('123', null, null), null)
        t.end()
      })
    })

    t.test('when proxying a callback should not try to wrap a null handler', function (t) {
      const { tracer, agent } = t.context
      helper.runInTransaction(agent, function () {
        t.equal(tracer.bindFunction(null), null)
        t.end()
      })
    })

    t.test('when handling immutable errors should not break in annotation process', function (t) {
      const expectErrMsg = 'FIREBOMB'
      const { tracer, agent } = t.context
      helper.runInTransaction(agent, function (trans) {
        function wrapMe() {
          const err = new Error(expectErrMsg)
          Object.freeze(err)
          throw err
        }
        try {
          // cannot use `t.throws` because we instrument things within the function
          // so the original throws then another throws and tap does not like that
          const fn = tracer.bindFunction(wrapMe, new Segment(trans, 'name'))
          fn()
        } catch (err) {
          t.equal(err.message, expectErrMsg)
          t.end()
        }
      })
    })

    t.test(
      'when a transaction is created inside a transaction should reuse the existing transaction instead of nesting',
      function (t) {
        const { agent } = t.context
        helper.runInTransaction(agent, function (outerTransaction) {
          const outerId = outerTransaction.id
          helper.runInTransaction(agent, function (innerTransaction) {
            const innerId = innerTransaction.id

            t.equal(innerId, outerId)
            t.end()
          })
        })
      }
    )
  })
})
