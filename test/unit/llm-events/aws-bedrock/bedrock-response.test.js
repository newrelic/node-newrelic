/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const structuredClone = require('./clone')
const BedrockResponse = require('../../../../lib/llm-events/aws-bedrock/bedrock-response')

const claude = {
  completion: 'claude-response',
  stop_reason: 'done'
}

const claude35 = {
  content: [
    { type: 'text', text: 'Hello' },
    { type: 'text', text: 'world' }
  ],
  stop_reason: 'done'
}

const cohere = {
  id: 'cohere-response-1',
  generations: [
    {
      text: 'cohere-response',
      finish_reason: 'done'
    }
  ]
}

const llama = {
  generation: 'llama-response',
  stop_reason: 'done'
}

const titan = {
  results: [
    {
      outputText: 'titan-response',
      completionReason: 'done'
    }
  ]
}

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.response = {
    response: {
      statusCode: 200,
      headers: {
        'x-amzn-requestid': 'aws-request-1',
        'x-foo': 'foo',
        'x-amzn-bedrock-input-token-count': '56',
        'x-amzn-bedrock-output-token-count': '46'
      }
    },
    output: {
      body: new TextEncoder().encode('{"foo":"foo"}'),
      output: {
        message: { content: [{ text: 'Hello world' }] },
      },
      usage: {
        inputTokens: 42,
        outputTokens: 58,
        totalTokens: 100
      }
    }
  }

  ctx.nr.bedrockCommand = {
    isClaude() {
      return false
    },
    isClaude3() {
      return false
    },
    isCohere() {
      return false
    },
    isLlama() {
      return false
    },
    isTitan() {
      return false
    },
    isConverse: false
  }

  ctx.nr.updatePayload = (payload) => {
    ctx.nr.response.output.body = new TextEncoder().encode(JSON.stringify(payload))
  }
})

test('non-conforming response is handled gracefully', async (t) => {
  delete t.nr.response.response.headers
  const res = new BedrockResponse(t.nr)
  assert.deepStrictEqual(res.completions, [])
  assert.equal(res.finishReason, undefined)
  assert.deepStrictEqual(res.headers, undefined)
  assert.equal(res.id, undefined)
  assert.equal(res.requestId, undefined)
  assert.equal(res.statusCode, 200)
})

test('claude malformed responses work', async (t) => {
  t.nr.bedrockCommand.isClaude = () => true
  const res = new BedrockResponse(t.nr)
  assert.deepStrictEqual(res.completions, [])
  assert.equal(res.finishReason, undefined)
  assert.deepStrictEqual(res.headers, t.nr.response.response.headers)
  assert.equal(res.id, undefined)
  assert.equal(res.requestId, 'aws-request-1')
  assert.equal(res.statusCode, 200)
})

test('claude complete responses work', async (t) => {
  t.nr.bedrockCommand.isClaude = () => true
  t.nr.updatePayload(structuredClone(claude))
  const res = new BedrockResponse(t.nr)
  assert.deepStrictEqual(res.completions, ['claude-response'])
  assert.equal(res.finishReason, 'done')
  assert.deepStrictEqual(res.headers, t.nr.response.response.headers)
  assert.equal(res.id, undefined)
  assert.equal(res.requestId, 'aws-request-1')
  assert.equal(res.statusCode, 200)
})

test('claude 3.5 complete responses work', async (t) => {
  t.nr.bedrockCommand.isClaude3 = () => true
  t.nr.updatePayload(structuredClone(claude35))
  const res = new BedrockResponse(t.nr)
  assert.deepStrictEqual(res.completions, ['Hello\n\nworld'])
  assert.equal(res.finishReason, 'done')
  assert.deepStrictEqual(res.headers, t.nr.response.response.headers)
  assert.equal(res.id, undefined)
  assert.equal(res.requestId, 'aws-request-1')
  assert.equal(res.statusCode, 200)
})

test('cohere malformed responses work', async (t) => {
  t.nr.bedrockCommand.isCohere = () => true
  const res = new BedrockResponse(t.nr)
  assert.deepStrictEqual(res.completions, [])
  assert.equal(res.finishReason, undefined)
  assert.deepStrictEqual(res.headers, t.nr.response.response.headers)
  assert.equal(res.id, undefined)
  assert.equal(res.requestId, 'aws-request-1')
  assert.equal(res.statusCode, 200)
})

test('cohere complete responses work', async (t) => {
  t.nr.bedrockCommand.isCohere = () => true
  t.nr.updatePayload(structuredClone(cohere))
  const res = new BedrockResponse(t.nr)
  assert.deepStrictEqual(res.completions, ['cohere-response'])
  assert.equal(res.finishReason, 'done')
  assert.deepStrictEqual(res.headers, t.nr.response.response.headers)
  assert.equal(res.id, 'cohere-response-1')
  assert.equal(res.requestId, 'aws-request-1')
  assert.equal(res.statusCode, 200)
})

test('llama malformed responses work', async (t) => {
  t.nr.bedrockCommand.isLlama = () => true
  const res = new BedrockResponse(t.nr)
  assert.deepStrictEqual(res.completions, [])
  assert.equal(res.finishReason, undefined)
  assert.deepStrictEqual(res.headers, t.nr.response.response.headers)
  assert.equal(res.id, undefined)
  assert.equal(res.requestId, 'aws-request-1')
  assert.equal(res.statusCode, 200)
})

test('llama complete responses work', async (t) => {
  t.nr.bedrockCommand.isLlama = () => true
  t.nr.updatePayload(structuredClone(llama))
  const res = new BedrockResponse(t.nr)
  assert.deepStrictEqual(res.completions, ['llama-response'])
  assert.equal(res.finishReason, 'done')
  assert.deepStrictEqual(res.headers, t.nr.response.response.headers)
  assert.equal(res.id, undefined)
  assert.equal(res.requestId, 'aws-request-1')
  assert.equal(res.statusCode, 200)
})

test('titan malformed responses work', async (t) => {
  t.nr.bedrockCommand.isTitan = () => true
  const res = new BedrockResponse(t.nr)
  assert.deepStrictEqual(res.completions, [])
  assert.equal(res.finishReason, undefined)
  assert.deepStrictEqual(res.headers, t.nr.response.response.headers)
  assert.equal(res.id, undefined)
  assert.equal(res.requestId, 'aws-request-1')
  assert.equal(res.statusCode, 200)
})

test('titan complete responses work', async (t) => {
  t.nr.bedrockCommand.isTitan = () => true
  t.nr.updatePayload(structuredClone(titan))
  const res = new BedrockResponse(t.nr)
  assert.deepStrictEqual(res.completions, ['titan-response'])
  assert.equal(res.finishReason, 'done')
  assert.deepStrictEqual(res.headers, t.nr.response.response.headers)
  assert.equal(res.id, undefined)
  assert.equal(res.requestId, 'aws-request-1')
  assert.equal(res.statusCode, 200)
})

test('should only set data from raw response on error', (t) => {
  t.nr.response.$response = { ...t.nr.response.response }
  delete t.nr.response.response
  delete t.nr.response.output
  t.nr.isError = true
  const res = new BedrockResponse(t.nr)
  assert.deepStrictEqual(res.completions, [])
  assert.equal(res.id, undefined)
  assert.equal(res.finishReason, undefined)
  assert.deepStrictEqual(res.headers, t.nr.response.$response.headers)
  assert.equal(res.requestId, 'aws-request-1')
  assert.equal(res.statusCode, 200)
})

test('inputTokenCount', (t) => {
  t.nr.bedrockCommand.isConverse = true
  const res = new BedrockResponse(t.nr)
  assert.equal(res.inputTokenCount, 42)
  t.nr.bedrockCommand.isConverse = false
  const res2 = new BedrockResponse(t.nr)
  assert.equal(res2.inputTokenCount, 56)
})

test('outputTokenCount', (t) => {
  t.nr.bedrockCommand.isConverse = true
  const res = new BedrockResponse(t.nr)
  assert.equal(res.outputTokenCount, 58)
  t.nr.bedrockCommand.isConverse = false
  const res2 = new BedrockResponse(t.nr)
  assert.equal(res2.outputTokenCount, 46)
})

test('totalTokenCount', (t) => {
  t.nr.bedrockCommand.isConverse = true
  const res = new BedrockResponse(t.nr)
  assert.equal(res.totalTokenCount, 100)
  t.nr.bedrockCommand.isConverse = false
  const res2 = new BedrockResponse(t.nr)
  assert.equal(res2.totalTokenCount, 102)
})
