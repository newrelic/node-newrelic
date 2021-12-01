/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Add a standard set of Legacy Context Manager test cases for testing
 * either the standard or diagnostic versions.
 */
function runLegacyTests(t, createContextManager) {
  t.test('Should default to null context', (t) => {
    const contextManager = createContextManager()

    const context = contextManager.getContext()

    t.equal(context, null)

    t.end()
  })

  t.test('setContext should update the current context', (t) => {
    const contextManager = createContextManager()

    const expectedContext = { name: 'new context' }

    contextManager.setContext(expectedContext)
    const context = contextManager.getContext()

    t.equal(context, expectedContext)

    t.end()
  })

  t.test('runInContext()', (t) => {
    t.autoend()

    t.test('should execute callback synchronously', (t) => {
      const contextManager = createContextManager()

      let callbackCalled = false
      contextManager.runInContext({}, () => {
        callbackCalled = true
      })

      t.equal(callbackCalled, true)

      t.end()
    })

    t.test('should set context to active for life of callback', (t) => {
      const contextManager = createContextManager()

      const previousContext = { name: 'previous' }
      contextManager.setContext(previousContext)

      const newContext = { name: 'new' }

      contextManager.runInContext(newContext, () => {
        const context = contextManager.getContext()

        t.equal(context, newContext)
        t.end()
      })
    })

    t.test('should restore previous context when callback completes', (t) => {
      const contextManager = createContextManager()

      const previousContext = { name: 'previous' }
      contextManager.setContext(previousContext)

      const newContext = { name: 'new' }
      contextManager.runInContext(newContext, () => {})

      const context = contextManager.getContext()

      t.equal(context, previousContext)

      t.end()
    })

    t.test('should restore previous context on exception', (t) => {
      const contextManager = createContextManager()

      const previousContext = { name: 'previous' }
      contextManager.setContext(previousContext)

      const newContext = { name: 'new' }

      try {
        contextManager.runInContext(newContext, () => {
          throw new Error('Something went bad')
        })
      } catch (error) {
        t.ok(error)
        // swallowing error
      }

      const context = contextManager.getContext()

      t.equal(context, previousContext)

      t.end()
    })

    t.test('should apply `cbThis` arg to execution', (t) => {
      const contextManager = createContextManager()

      const previousContext = { name: 'previous' }
      contextManager.setContext(previousContext)

      const newContext = { name: 'new' }
      const expectedThis = () => {}

      contextManager.runInContext(newContext, functionRunInContext, expectedThis)

      function functionRunInContext() {
        t.equal(this, expectedThis)
        t.end()
      }
    })

    t.test('should apply args array to execution', (t) => {
      const contextManager = createContextManager()

      const previousContext = { name: 'previous' }
      contextManager.setContext(previousContext)

      const newContext = { name: 'new' }
      const expectedArg1 = 'first arg'
      const expectedArg2 = 'second arg'
      const args = [expectedArg1, expectedArg2]

      contextManager.runInContext(newContext, functionRunInContext, null, args)

      function functionRunInContext(arg1, arg2) {
        t.equal(arg1, expectedArg1)
        t.equal(arg2, expectedArg2)
        t.end()
      }
    })

    t.test('should apply arguments construct to execution', (t) => {
      const contextManager = createContextManager()

      const previousContext = { name: 'previous' }
      contextManager.setContext(previousContext)

      const newContext = { name: 'new' }
      const expectedArg1 = 'first arg'
      const expectedArg2 = 'second arg'

      executingFunction(expectedArg1, expectedArg2)

      function executingFunction() {
        contextManager.runInContext(newContext, functionRunInContext, null, arguments)
      }

      function functionRunInContext(arg1, arg2) {
        t.equal(arg1, expectedArg1)
        t.equal(arg2, expectedArg2)
        t.end()
      }
    })
  })
}

module.exports = runLegacyTests
