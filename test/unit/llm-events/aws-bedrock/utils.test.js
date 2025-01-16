/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { stringifyClaudeChunkedMessage } = require('../../../../lib/llm-events/aws-bedrock/utils')

test('interleaves text chunks with other types', async (t) => {
  const out = stringifyClaudeChunkedMessage([
    { type: 'text', text: 'Hello' },
    { type: 'image', source: { type: 'base64', data: 'U29tZSByYW5kb20gaW1hZ2U=', media_type: 'image/jpeg' } },
    { type: 'text', text: 'world' }
  ])

  assert.equal(out, 'Hello\n\n<image>\n\nworld')
})

test('adds a placeholder for unrecognized chunk types', async (t) => {
  const out = stringifyClaudeChunkedMessage([
    { type: 'text', text: 'Hello' },
    { type: 'direct_neural_upload', data: 'V2hhdCBzaG91bGQgSSBtYWtlIGZvciBkaW5uZXI/' },
    { type: 'text', text: 'world' }
  ])

  assert.equal(out, 'Hello\n\n<unknown_chunk>\n\nworld')
})

test('adds information about tool calls', async (t) => {
  const out = stringifyClaudeChunkedMessage([
    { type: 'text', text: 'I will look up the weather in Philly' },
    { type: 'tool_use', name: 'lookup_weather', input: { city: 'Philly' }, id: 'abc123' },
  ])

  assert.equal(out, 'I will look up the weather in Philly\n\n<tool_use>lookup_weather</tool_use>')
})

test('adds information about tool results', async (t) => {
  const out = stringifyClaudeChunkedMessage([
    { type: 'text', text: 'Here is the weather in philly' },
    { type: 'tool_result', name: 'lookup_weather', content: 'Nice!', tool_use_id: 'abc123' },
  ])

  assert.equal(out, 'Here is the weather in philly\n\n<tool_result>Nice!</tool_result>')
})
