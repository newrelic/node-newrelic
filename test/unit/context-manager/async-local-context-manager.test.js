/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const AsyncLocalContextManager = require('../../../lib/context-manager/async-local-context-manager')
const Context = require('../../../lib/context-manager/context')

test('Should default to null context', () => {
  const contextManager = new AsyncLocalContextManager()

  const context = contextManager.getContext()

  assert.ok(context instanceof Context)
  assert.equal(context.transaction, null)
  assert.equal(context.segment, null)
  assert.deepEqual(context.extras, {})
})

test('setContext should update the current context', () => {
  const contextManager = new AsyncLocalContextManager()

  const expectedContext = new Context('tx', 'new context')
  contextManager.setContext(expectedContext)
  const context = contextManager.getContext()

  assert.equal(context, expectedContext)
})

test('runInContext()', async (t) => {
  await t.test('should execute callback synchronously', () => {
    const contextManager = new AsyncLocalContextManager()
    const context = contextManager.getContext()

    let callbackCalled = false
    contextManager.runInContext(context, () => {
      callbackCalled = true
    })

    assert.equal(callbackCalled, true)
  })

  await t.test('should set context to active for life of callback', (t, end) => {
    const contextManager = new AsyncLocalContextManager()

    const context = contextManager.getContext()
    const previousContext = context.enterSegment({ segment: 'previous', transaction: 'tx' })
    contextManager.setContext(previousContext)

    const newContext = context.enterSegment({ segment: 'new', transaction: 'tx1' })

    contextManager.runInContext(newContext, () => {
      const context = contextManager.getContext()

      assert.equal(context, newContext)
      end()
    })
  })

  await t.test('should restore previous context when callback completes', () => {
    const contextManager = new AsyncLocalContextManager()

    const context = contextManager.getContext()
    const previousContext = context.enterSegment({ segment: 'previous', transaction: 'tx' })
    contextManager.setContext(previousContext)

    const newContext = context.enterSegment({ segment: 'new', transaction: 'tx1' })
    contextManager.runInContext(newContext, () => {})

    assert.deepEqual(contextManager.getContext(), previousContext)
  })

  await t.test('should run a function in a transaction', () => {
    const contextManager = new AsyncLocalContextManager()

    let context = contextManager.getContext()
    const transaction = { name: 'tx', trace: { root: { name: 'foo' } } }
    context = context.enterTransaction(transaction)

    contextManager.runInContext(context, () => {
      const curContext = contextManager.getContext()
      assert.equal(curContext.transaction, transaction)
      assert.equal(curContext.segment, transaction.trace.root)
    })
  })

  await t.test('should restore previous context on exception', () => {
    const contextManager = new AsyncLocalContextManager()

    const context = contextManager.getContext()
    const previousContext = context.enterSegment({ segment: 'previous', transaction: 'tx' })
    contextManager.setContext(previousContext)

    const newContext = context.enterSegment({ segment: 'new', transaction: 'tx1' })

    try {
      contextManager.runInContext(newContext, () => {
        throw new Error('Something went bad')
      })
    } catch (error) {
      assert.ok(error)
      // swallowing error
    }

    assert.deepEqual(contextManager.getContext(), previousContext)
  })

  await t.test('should apply `cbThis` arg to execution', (t, end) => {
    const contextManager = new AsyncLocalContextManager()

    const context = contextManager.getContext()
    const expectedThis = () => {}

    contextManager.runInContext(context, functionRunInContext, expectedThis)

    function functionRunInContext() {
      assert.equal(this, expectedThis)
      end()
    }
  })

  await t.test('should apply args array to execution', (t, end) => {
    const contextManager = new AsyncLocalContextManager()

    const context = contextManager.getContext()
    const expectedArg1 = 'first arg'
    const expectedArg2 = 'second arg'
    const args = [expectedArg1, expectedArg2]

    contextManager.runInContext(context, functionRunInContext, null, args)

    function functionRunInContext(arg1, arg2) {
      assert.equal(arg1, expectedArg1)
      assert.equal(arg2, expectedArg2)
      end()
    }
  })

  await t.test('should apply arguments construct to execution', (t, end) => {
    const contextManager = new AsyncLocalContextManager()
    const context = contextManager.getContext()
    const expectedArg1 = 'first arg'
    const expectedArg2 = 'second arg'

    executingFunction(expectedArg1, expectedArg2)

    function executingFunction() {
      contextManager.runInContext(
        context,
        function functionRunInContext(arg1, arg2) {
          assert.equal(arg1, expectedArg1)
          assert.equal(arg2, expectedArg2)
          end()
        },
        null,
        arguments
      )
    }
  })

  await t.test('should allow to assign random key/value paris to context', (t) => {
    const contextManager = new AsyncLocalContextManager()
    const context = contextManager.getContext()
    let newContext = context.setExtras({ key: 'value', anotherKey: 'anotherValue' })
    assert.deepEqual(newContext.extras, { key: 'value', anotherKey: 'anotherValue' })
    newContext = newContext.setExtras({ key: 'newValue', yetAnotherKey: 'yetAnotherValue' })
    assert.deepEqual(newContext.extras, { key: 'newValue', anotherKey: 'anotherValue', yetAnotherKey: 'yetAnotherValue' })
  })
})
