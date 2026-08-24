/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const ConverseCommand = require('../../../../lib/llm-events/aws-bedrock/converse-command')

test('non-conforming command is handled gracefully', (t) => {
  const cmd = new ConverseCommand({ messages: [] })
  assert.equal(cmd.modelId, '')
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [])
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.temperature, undefined)
})

test('minimal converse command works', (t) => {
  const cmd = new ConverseCommand({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    messages: [{ role: 'user', content: [{ text: 'who are you' }] }]
  })
  assert.equal(cmd.modelId, 'anthropic.claude-3-haiku-20240307-v1:0')
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: 'who are you' }])
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.temperature, undefined)
})

test('modelId is lowercased', (t) => {
  const cmd = new ConverseCommand({
    modelId: 'US.Anthropic.Claude-3-Haiku-20240307-V1:0',
    messages: []
  })
  assert.equal(cmd.modelId, 'us.anthropic.claude-3-haiku-20240307-v1:0')
})

test('embedding modelId is detected', (t) => {
  const cmd = new ConverseCommand({ modelId: 'cohere.embed-english-v3', messages: [] })
  assert.equal(cmd.modelType, 'embedding')
})

test('complete converse command works', (t) => {
  const cmd = new ConverseCommand({
    modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    messages: [
      { role: 'user', content: [{ text: 'who are' }] },
      { role: 'assistant', content: [{ text: 'researching' }] },
      { role: 'user', content: [{ text: 'you' }] }
    ],
    inferenceConfig: {
      maxTokens: 25,
      temperature: 0.5
    }
  })
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.temperature, 0.5)
  assert.deepEqual(cmd.prompt, [
    { role: 'user', content: 'who are' },
    { role: 'assistant', content: 'researching' },
    { role: 'user', content: 'you' }
  ])
})

test('prompt joins multi-chunk content for a single message', (t) => {
  const cmd = new ConverseCommand({
    messages: [{ role: 'user', content: [{ text: 'Hello' }, { text: 'world' }] }]
  })
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: 'Hello\n\nworld' }])
})

test('prompt skips messages whose content is not chunked', (t) => {
  const cmd = new ConverseCommand({
    messages: [
      { role: 'user', content: [{ text: 'who are you' }] },
      { role: 'user', content: 'not-chunked' },
      null,
      { role: 'user' }
    ]
  })
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: 'who are you' }])
})
