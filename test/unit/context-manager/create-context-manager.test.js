/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')
const semver = require('semver')

const createImplementation = require('../../../lib/context-manager/create-context-manager')
const LegacyContextManager = require('../../../lib/context-manager/legacy-context-manager')
const LegacyDiagnosticContextManager = require('../../../lib/context-manager/diagnostics/legacy-diagnostic-context-manager')
const AsyncLocalContextManager = require('../../../lib/context-manager/async-local-context-manager')

test('Should return LegacyContextManager by default', (t) => {
  const contextManager = createImplementation({
    logging: {},
    feature_flag: {}
  })

  t.ok(contextManager instanceof LegacyContextManager)
  t.end()
})

test('Should return LegacyDiagnosticsContextManager when diagnostic logging enabled', (t) => {
  const contextManager = createImplementation({
    logging: {
      diagnostics: true
    },
    feature_flag: {}
  })

  t.ok(contextManager instanceof LegacyDiagnosticContextManager)
  t.end()
})

test('Should return AsyncContextManager when feature-flag enabled and version >= 16', (t) => {
  if (semver.satisfies(process.version, '<16.4.0')) {
    tempOverrideNodeVersion(t, '16.4.0')
  }

  const contextManager = createImplementation({
    logging: {},
    feature_flag: {
      async_local_context: true
    }
  })

  t.ok(contextManager instanceof AsyncLocalContextManager)
  t.end()
})

test('Should return LegacyContextManager when feature-flag enabled and version <= 16', (t) => {
  if (semver.satisfies(process.version, '>=16.4.0')) {
    tempOverrideNodeVersion(t, '15.0.0')
  }

  const contextManager = createImplementation({
    logging: {},
    feature_flag: {
      async_local_context: true
    }
  })

  t.ok(contextManager instanceof LegacyContextManager)
  t.end()
})

function tempOverrideNodeVersion(t, newVersion) {
  const oldVersion = process.version

  Object.defineProperty(process, 'version', { value: newVersion, writable: true })

  t.teardown(() => {
    process.version = oldVersion
  })
}
