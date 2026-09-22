/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')

const otel = require('@opentelemetry/api')
const { SUPPRESS_TRACING_KEY } = require('#agentlib/otel/constants.js')
const isTracingSuppressed = require('#agentlib/otel/utils/is-tracing-suppressed.js')

test('returns false when suppress tracing key is not set on context', () => {
  const context = otel.context.active()
  assert.equal(isTracingSuppressed(context), false)
})

test('returns false when suppress tracing key is set to a falsy value', () => {
  const context = otel.context.active().setValue(SUPPRESS_TRACING_KEY, false)
  assert.equal(isTracingSuppressed(context), false)
})

test('returns false when suppress tracing key is set to a truthy, non-true value', () => {
  const context = otel.context.active().setValue(SUPPRESS_TRACING_KEY, 'true')
  assert.equal(isTracingSuppressed(context), false)
})

test('returns true when suppress tracing key is set to true', () => {
  const context = otel.context.active().setValue(SUPPRESS_TRACING_KEY, true)
  assert.equal(isTracingSuppressed(context), true)
})

test('calls getValue with the suppress tracing key', () => {
  const context = { getValue: sinon.stub().returns(true) }
  const result = isTracingSuppressed(context)
  assert.equal(result, true)
  assert.ok(context.getValue.calledOnceWithExactly(SUPPRESS_TRACING_KEY))
})
