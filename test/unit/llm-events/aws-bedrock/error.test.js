/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LlmError = require('../../../../lib/llm-events/aws-bedrock/error')

tap.beforeEach((t) => {
  t.context.bedrockResponse = {
    statusCode: 400
  }

  t.context.err = {
    message: 'No soup for you',
    name: 'SoupRule'
  }

  t.context.summary = {
    id: 'completion-id'
  }
})

tap.test('create creates a new instance', (t) => {
  const err = new LlmError(t.context)
  t.equal(err['http.statusCode'], 400)
  t.equal(err['error.message'], 'No soup for you')
  t.equal(err['error.code'], 'SoupRule')
  t.equal(err.completion_id, 'completion-id')
  t.notOk(err.embedding_id)
  t.end()
})

tap.test('create error with embedding_id', (t) => {
  delete t.context.summary
  t.context.embedding = { id: 'embedding-id' }
  const err = new LlmError(t.context)
  t.equal(err['http.statusCode'], 400)
  t.equal(err['error.message'], 'No soup for you')
  t.equal(err['error.code'], 'SoupRule')
  t.equal(err.embedding_id, 'embedding-id')
  t.notOk(err.completion_id)
  t.end()
})

tap.test('empty error', (t) => {
  const err = new LlmError()
  t.notOk(err['http.statusCode'])
  t.notOk(err['error.message'])
  t.notOk(err['error.code'])
  t.notOk(err.completion_id)
  t.notOk(err.embedding_id)
  t.end()
})
