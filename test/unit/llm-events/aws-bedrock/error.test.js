/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LlmErrorMessage = require('#agentlib/llm-events/error-message.js')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.response = {
    statusCode: 400
  }

  // The cause of the error.
  ctx.nr.cause = {
    message: 'No soup for you',
    name: 'SoupRule'
  }

  ctx.nr.summary = {
    id: 'completion-id'
  }

  ctx.nr.useNameAsCode = true
})

test('create creates a new instance', (t) => {
  const err = new LlmErrorMessage(t.nr)
  assert.equal(err['http.statusCode'], 400)
  assert.equal(err['error.message'], 'No soup for you')
  assert.equal(err['error.code'], 'SoupRule')
  assert.equal(err.completion_id, 'completion-id')
  assert.ok(!err.embedding_id)
})

test('create error with embedding_id', (t) => {
  delete t.nr.summary
  t.nr.embedding = { id: 'embedding-id' }
  const err = new LlmErrorMessage(t.nr)
  assert.equal(err['http.statusCode'], 400)
  assert.equal(err['error.message'], 'No soup for you')
  assert.equal(err['error.code'], 'SoupRule')
  assert.equal(err.embedding_id, 'embedding-id')
  assert.ok(!err.completion_id)
})

test('empty error', () => {
  const err = new LlmErrorMessage()
  assert.ok(!err['http.statusCode'])
  assert.ok(!err['error.message'])
  assert.ok(!err['error.code'])
  assert.ok(!err.completion_id)
  assert.ok(!err.embedding_id)
})
