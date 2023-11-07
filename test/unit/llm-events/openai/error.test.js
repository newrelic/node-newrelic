/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const LlmErrorMessage = require('../../../../lib/llm-events/openai/error-message')
const { req, chatRes } = require('./common')

tap.test('LlmErrorMessage', (t) => {
  const res = { ...chatRes, code: 'insufficient_quota', param: 'test-param', status: 429 }
  const errorMsg = new LlmErrorMessage(req, res)
  const serialized = errorMsg.serialize()
  const expected =
    '{"api_key_last_four_digits":"sk-7890","request.model":"gpt-3.5-turbo-0613","request.temperature":"medium-rare","request.max_tokens":"1000000","vendor":"openAI","ingest_source":"Node","response.number_of_messages":2,"http.statusCode":429,"response.organization":"new-relic","error.code":"insufficient_quota","error.param":"test-param"}'
  t.equal(serialized, expected)
  t.end()
})
