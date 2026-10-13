/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { resourceFromAttributes } = require('#agentlib/otel/metrics/nr-resource.js')

test('exposes the provided attributes', (t) => {
  const resource = resourceFromAttributes({ 'entity.guid': 'guid-123', appName: 'test-app' })
  assert.deepEqual(resource.attributes, { 'entity.guid': 'guid-123', appName: 'test-app' })
})

test('drops null and undefined attribute values', (t) => {
  const resource = resourceFromAttributes({ keep: 'me', dropNull: null, dropUndefined: undefined })
  assert.deepEqual(resource.attributes, { keep: 'me' })
})

test('defaults to an empty attributes object', (t) => {
  const resource = resourceFromAttributes()
  assert.deepEqual(resource.attributes, {})
})

test('asyncAttributesPending is always false', (t) => {
  const resource = resourceFromAttributes({ foo: 'bar' })
  assert.equal(resource.asyncAttributesPending, false)
})

test('waitForAsyncAttributes resolves immediately', async (t) => {
  const resource = resourceFromAttributes({ foo: 'bar' })
  await assert.doesNotReject(() => resource.waitForAsyncAttributes())
})
