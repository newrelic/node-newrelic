/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')

const createImplementation = require('../../../lib/context-manager/create-context-manager')
const LegacyContextManager = require('../../../lib/context-manager/legacy-context-manager')
const LegacyDiagnosticContextManager = require('../../../lib/context-manager/diagnostics/legacy-diagnostic-context-manager')

test('Should return LegacyContextManager by default', (t) => {
  const contextManager = createImplementation({
    logging: {}
  })

  t.ok(contextManager instanceof LegacyContextManager)
  t.end()
})

test('Should return LegacyDiagnosticsContextManager when diagnostic logging enabled', (t) => {
  const contextManager = createImplementation({
    logging: {
      diagnostics: true
    }
  })

  t.ok(contextManager instanceof LegacyDiagnosticContextManager)
  t.end()
})
