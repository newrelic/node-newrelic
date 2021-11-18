/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

tap.test('Agent API - startBackgroundTransaction', (t) => {
  t.autoend()

  let agent = null
  let contextManager = null
  let api = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
    contextManager = helper.getContextManager()
    api = new API(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
    contextManager = null
  })

  t.test('should not throw when transaction cannot be created', (t) => {
    agent.setState('stopped')
    api.startBackgroundTransaction('test', () => {
      const transaction = agent.tracer.getTransaction()
      t.notOk(transaction)

      t.end()
    })
  })

  t.test('should add nested transaction as segment to parent transaction', (t) => {
    let transaction = null

    api.startBackgroundTransaction('test', function () {
      nested()
      transaction = agent.tracer.getTransaction()

      t.equal(transaction.type, 'bg')
      t.equal(transaction.getFullName(), 'OtherTransaction/Nodejs/test')
      t.ok(transaction.isActive())

      const currentSegment = contextManager.getContext()
      const nestedSegment = currentSegment.children[0]
      t.equal(nestedSegment.name, 'Nodejs/nested')
    })

    function nested() {
      api.startBackgroundTransaction('nested', function () {})
    }

    t.notOk(transaction.isActive())

    t.end()
  })

  t.test('should end the transaction after the handle returns by default', (t) => {
    let transaction = null

    api.startBackgroundTransaction('test', function () {
      transaction = agent.tracer.getTransaction()
      t.equal(transaction.type, 'bg')
      t.equal(transaction.getFullName(), 'OtherTransaction/Nodejs/test')
      t.ok(transaction.isActive())
    })

    t.notOk(transaction.isActive())

    t.end()
  })

  t.test('should be namable with setTransactionName', (t) => {
    let handle = null
    let transaction = null
    api.startBackgroundTransaction('test', function () {
      transaction = agent.tracer.getTransaction()
      handle = api.getTransaction()
      api.setTransactionName('custom name')

      t.equal(transaction.type, 'bg')
      t.equal(transaction.getFullName(), 'OtherTransaction/Custom/custom name')
      t.ok(transaction.isActive())
    })

    process.nextTick(function () {
      handle.end()

      t.notOk(transaction.isActive())
      t.equal(transaction.getFullName(), 'OtherTransaction/Custom/custom name')

      t.end()
    })
  })

  t.test('should start a background txn with the given name as the name and group', (t) => {
    let transaction = null
    api.startBackgroundTransaction('test', 'group', function () {
      transaction = agent.tracer.getTransaction()
      t.ok(transaction)

      t.equal(transaction.type, 'bg')
      t.equal(transaction.getFullName(), 'OtherTransaction/group/test')
      t.ok(transaction.isActive())
    })

    t.notOk(transaction.isActive())

    t.end()
  })

  t.test('should end the txn after a promise returned by the txn function resolves', (t) => {
    let thenCalled = false
    const FakePromise = {
      then: function (f) {
        thenCalled = true
        f()
        return this
      }
    }

    let transaction = null
    api.startBackgroundTransaction('test', function () {
      transaction = agent.tracer.getTransaction()

      t.equal(transaction.type, 'bg')
      t.equal(transaction.getFullName(), 'OtherTransaction/Nodejs/test')
      t.ok(transaction.isActive())

      t.notOk(thenCalled)
      return FakePromise
    })

    t.ok(thenCalled)

    t.notOk(transaction.isActive())

    t.end()
  })

  t.test('should not end the txn if the txn is being handled externally', (t) => {
    let transaction = null
    api.startBackgroundTransaction('test', function () {
      transaction = agent.tracer.getTransaction()

      t.equal(transaction.type, 'bg')
      t.equal(transaction.getFullName(), 'OtherTransaction/Nodejs/test')
      t.ok(transaction.isActive())

      transaction.handledExternally = true
    })

    t.ok(transaction.isActive())

    transaction.end()
    t.end()
  })

  t.test('should call the handler if no name is supplied', (t) => {
    api.startBackgroundTransaction(null, function () {
      const transaction = agent.tracer.getTransaction()
      t.notOk(transaction)

      t.end()
    })
  })

  t.test('should not throw when no handler is supplied', (t) => {
    t.doesNotThrow(() => api.startBackgroundTransaction('test'))
    t.doesNotThrow(() => api.startBackgroundTransaction('test', 'asdf'))
    t.doesNotThrow(() => api.startBackgroundTransaction('test', 'asdf', 'not a function'))

    t.end()
  })
})
