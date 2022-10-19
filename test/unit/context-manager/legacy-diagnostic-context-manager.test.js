/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')

const LegacyDiagnosticContextManager = require('../../../lib/context-manager/diagnostics/legacy-diagnostic-context-manager')
const runContextManagerTests = require('./context-manager-tests')

const EXPECTED_REMOVE_MESSAGE = 'Removed from context'
const EXPECTED_SET_MESSAGE = 'Set in context'

test('Legacy Diagnostic Context Manager', (t) => {
  t.autoend()

  runContextManagerTests(t, createContextManager)

  t.test('Should call probe on item manually entering context', (t) => {
    const diagnosticTestItem = new DiagnosticTestItem()

    const contextManager = createContextManager()

    contextManager.setContext(diagnosticTestItem)

    t.equal(diagnosticTestItem.lastMessage, EXPECTED_SET_MESSAGE)
    t.end()
  })

  t.test('Should call probe on item manually leaving context', (t) => {
    const diagnosticTestItem = new DiagnosticTestItem()

    const contextManager = createContextManager()
    contextManager.setContext(diagnosticTestItem)

    contextManager.setContext(null)

    t.equal(diagnosticTestItem.lastMessage, EXPECTED_REMOVE_MESSAGE)
    t.end()
  })

  t.test('Should call probe on item entering context via runInContext', (t) => {
    const diagnosticTestItem = new DiagnosticTestItem()

    const contextManager = createContextManager()
    contextManager.runInContext(diagnosticTestItem, () => {
      t.equal(diagnosticTestItem.lastMessage, EXPECTED_SET_MESSAGE)
      t.end()
    })
  })

  t.test('Should call probe on item leaving context via runInContext', (t) => {
    const diagnosticTestItem = new DiagnosticTestItem()

    const contextManager = createContextManager()
    contextManager.setContext(diagnosticTestItem)

    contextManager.runInContext(null, () => {
      t.equal(diagnosticTestItem.lastMessage, EXPECTED_REMOVE_MESSAGE)
      t.end()
    })
  })

  t.test('Should call probe on item re-entering context leaving runInContext', (t) => {
    const diagnosticTestItem = new DiagnosticTestItem()

    const contextManager = createContextManager()
    contextManager.setContext(diagnosticTestItem)

    contextManager.runInContext(null, () => {})

    t.equal(diagnosticTestItem.lastMessage, EXPECTED_SET_MESSAGE)
    t.end()
  })

  t.test('Should call probe on item removed from context leaving runInContext', (t) => {
    const diagnosticTestItem = new DiagnosticTestItem()

    const contextManager = createContextManager()

    contextManager.runInContext(diagnosticTestItem, () => {})

    t.equal(diagnosticTestItem.lastMessage, EXPECTED_REMOVE_MESSAGE)
    t.end()
  })
})

function createContextManager() {
  return new LegacyDiagnosticContextManager({})
}

class DiagnosticTestItem {
  probe(message) {
    this.lastMessage = message
  }
}
