/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LlmErrorMessage = require('../../../lib/llm-events/error-message')
const { req, chatRes } = require('./openai/common')

tap.test('LlmErrorMessage', (t) => {
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
  t.same(errorMsg, expected)
  t.end()
})
