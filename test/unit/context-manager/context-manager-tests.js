/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')

/**
 * Add a standard set of Legacy Context Manager test cases for testing
 * either the standard or diagnostic versions.
 */
async function runContextMangerTests(t, createContextManager) {
  await t.test('Should default to null context', () => {
    const contextManager = createContextManager()

    const context = contextManager.getContext()

    assert.equal(context, null)
  })

  await t.test('setContext should update the current context', () => {
    const contextManager = createContextManager()

    const expectedContext = { name: 'new context' }

    contextManager.setContext(expectedContext)
    const context = contextManager.getContext()

    assert.equal(context, expectedContext)
  })

  await t.test('runInContext()', async (t) => {
    await t.test('should execute callback synchronously', () => {
      const contextManager = createContextManager()

      let callbackCalled = false
      contextManager.runInContext({}, () => {
        callbackCalled = true
      })

      assert.equal(callbackCalled, true)
    })

    await t.test('should set context to active for life of callback', (t, end) => {
      const contextManager = createContextManager()

      const previousContext = { name: 'previous' }
      contextManager.setContext(previousContext)

      const newContext = { name: 'new' }

      contextManager.runInContext(newContext, () => {
        const context = contextManager.getContext()

        assert.equal(context, newContext)
        end()
      })
    })

    await t.test('should restore previous context when callback completes', () => {
      const contextManager = createContextManager()

      const previousContext = { name: 'previous' }
      contextManager.setContext(previousContext)

      const newContext = { name: 'new' }
      contextManager.runInContext(newContext, () => {})

      const context = contextManager.getContext()

      assert.equal(context, previousContext)
    })

    await t.test('should restore previous context on exception', () => {
      const contextManager = createContextManager()

      const previousContext = { name: 'previous' }
      contextManager.setContext(previousContext)

      const newContext = { name: 'new' }

      try {
        contextManager.runInContext(newContext, () => {
          throw new Error('Something went bad')
        })
      } catch (error) {
        assert.ok(error)
        // swallowing error
      }

      const context = contextManager.getContext()

      assert.equal(context, previousContext)
    })

    await t.test('should apply `cbThis` arg to execution', (t, end) => {
      const contextManager = createContextManager()

      const previousContext = { name: 'previous' }
      contextManager.setContext(previousContext)

      const newContext = { name: 'new' }
      const expectedThis = () => {}

      contextManager.runInContext(newContext, functionRunInContext, expectedThis)

      function functionRunInContext() {
        assert.equal(this, expectedThis)
        end()
      }
    })

    await t.test('should apply args array to execution', (t, end) => {
      const contextManager = createContextManager()

      const previousContext = { name: 'previous' }
      contextManager.setContext(previousContext)

      const newContext = { name: 'new' }
      const expectedArg1 = 'first arg'
      const expectedArg2 = 'second arg'
      const args = [expectedArg1, expectedArg2]

      contextManager.runInContext(newContext, functionRunInContext, null, args)

      function functionRunInContext(arg1, arg2) {
        assert.equal(arg1, expectedArg1)
        assert.equal(arg2, expectedArg2)
        end()
      }
    })

    await t.test('should apply arguments construct to execution', (t, end) => {
      const contextManager = createContextManager()

      const previousContext = { name: 'previous' }
      contextManager.setContext(previousContext)

      const newContext = { name: 'new' }
      const expectedArg1 = 'first arg'
      const expectedArg2 = 'second arg'

      executingFunction(expectedArg1, expectedArg2)

      function executingFunction() {
        contextManager.runInContext(
          newContext,
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
  })
}

module.exports = runContextMangerTests
