/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test
const helper = require('../../lib/agent_helper')

function QContext(t, agent) {
  this.agent = agent
  this.test = t
}

QContext.prototype.assertTransaction = function assertTransaction(transaction) {
  this.test.equal(this.agent.getTransaction(), transaction)
  this.test.equal(this.agent.getTransaction().trace.root.children.length, 0)
}

test('q.ninvoke', function testQNInvoke(t) {
  const agent = setupAgent(t)
  const q = require('q')
  const qContext = new QContext(t, agent)

  const firstTest = q.defer()
  const secondTest = q.defer()

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    q.ninvoke(function () {
      qContext.assertTransaction(transaction)
      firstTest.resolve()
    })
  })

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    q.ninvoke(function () {
      qContext.assertTransaction(transaction)
      secondTest.resolve()
    })
  })

  q.all([firstTest, secondTest]).then(function done() {
    t.end()
  })
})

test('q.then', function testQNInvoke(t) {
  const agent = setupAgent(t)
  const q = require('q')
  const qContext = new QContext(t, agent)

  const firstTest = q.defer()
  const secondTest = q.defer()

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    q(true).then(function () {
      qContext.assertTransaction(transaction)
      firstTest.resolve()
    })
  })

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    q(true).then(function () {
      qContext.assertTransaction(transaction)
      secondTest.resolve()
    })
  })

  q.all([firstTest, secondTest]).then(function done() {
    t.end()
  })
})

test('q.then rejections', function testQNInvoke(t) {
  helper.temporarilyOverrideTapUncaughtBehavior(tap, t)

  t.plan(4)

  const agent = setupAgent(t)
  const q = require('q')
  const qContext = new QContext(t, agent)

  const firstTest = q.defer()
  const secondTest = q.defer()

  helper.temporarilyRemoveListeners(t, process, 'unhandledRejection')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    const thrownError = new Error('First unhandled error')
    process.on('unhandledRejection', function rejectionHandler(error) {
      if (error === thrownError) {
        qContext.assertTransaction(transaction)
        firstTest.resolve()
      }
    })

    q(true).then(function () {
      throw thrownError
    })
  })

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    const thrownError = new Error('Second unhandled error')
    process.on('unhandledRejection', function rejectionHandler(error) {
      if (error === thrownError) {
        qContext.assertTransaction(transaction)
        secondTest.resolve()
      }
    })

    q(true).then(function () {
      throw thrownError
    })
  })

  q.all([firstTest.promise, secondTest.promise]).then(function done() {
    t.end()
  })
})

function setupAgent(t) {
  const agent = helper.instrumentMockedAgent()
  t.teardown(function tearDown() {
    helper.unloadAgent(agent)
  })

  return agent
}
