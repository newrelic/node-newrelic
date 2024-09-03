/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const LlmErrorMessage = require('../../../lib/llm-events/error-message')
const { req, chatRes } = require('./openai/common')

test('LlmErrorMessage', async () => {
  const res = { ...chatRes, code: 'insufficient_quota', param: 'test-param', status: 429 }
  const errorMsg = new LlmErrorMessage({ request: req, response: res })
  const expected = {
    'http.statusCode': 429,
    'error.message': undefined,
    'error.code': 'insufficient_quota',
    'error.param': 'test-param',
    'completion_id': undefined,
    'embedding_id': undefined,
    'vector_store_id': undefined,
    'tool_id': undefined
  }
  assert.ok(errorMsg.toString(), 'LlmErrorMessage')
  assert.equal(errorMsg['http.statusCode'], expected['http.statusCode'])
  assert.equal(errorMsg['error.message'], expected['error.message'])
  assert.equal(errorMsg['error.code'], expected['error.code'])
  assert.equal(errorMsg['error.param'], expected['error.param'])
  assert.equal(errorMsg.completion_id, expected.completion_id)
  assert.equal(errorMsg.embedding_id, expected.embedding_id)
  assert.equal(errorMsg.vector_store_id, expected.vector_store_id)
  assert.equal(errorMsg.tool_id, expected.tool_id)
})
