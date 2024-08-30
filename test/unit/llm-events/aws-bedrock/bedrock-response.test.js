/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const structuredClone = require('./clone')
const BedrockResponse = require('../../../../lib/llm-events/aws-bedrock/bedrock-response')

const ai21 = {
  id: 'ai21-response-1',
  completions: [
    {
      data: {
        text: 'ai21-response'
      },
      finishReason: {
        reason: 'done'
      }
    }
  ]
}

const claude = {
  completion: 'claude-response',
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

test('all tests', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.response = {
      response: {
        statusCode: 200,
        headers: {
          'x-amzn-requestid': 'aws-request-1',
          'x-foo': 'foo'
        }
      },
      output: {
        body: new TextEncoder().encode('{"foo":"foo"}')
      }
    }

    ctx.nr.bedrockCommand = {
      isAi21() {
        return false
      },
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
      }
    }

    ctx.nr.updatePayload = (payload) => {
      ctx.nr.response.output.body = new TextEncoder().encode(JSON.stringify(payload))
    }
  })

  await t.test('non-conforming response is handled gracefully', async (ctx) => {
    delete ctx.nr.response.response.headers
    const res = new BedrockResponse(ctx.nr)
    assert.deepStrictEqual(res.completions, [])
    assert.equal(res.finishReason, undefined)
    assert.deepStrictEqual(res.headers, undefined)
    assert.equal(res.id, undefined)
    assert.equal(res.requestId, undefined)
    assert.equal(res.statusCode, 200)
  })

  await t.test('ai21 malformed responses work', async (ctx) => {
    ctx.nr.bedrockCommand.isAi21 = () => true
    const res = new BedrockResponse(ctx.nr)
    assert.deepStrictEqual(res.completions, [])
    assert.equal(res.finishReason, undefined)
    assert.deepStrictEqual(res.headers, ctx.nr.response.response.headers)
    assert.equal(res.id, undefined)
    assert.equal(res.requestId, 'aws-request-1')
    assert.equal(res.statusCode, 200)
  })

  await t.test('ai21 complete responses work', async (ctx) => {
    ctx.nr.bedrockCommand.isAi21 = () => true
    ctx.nr.updatePayload(structuredClone(ai21))
    const res = new BedrockResponse(ctx.nr)
    assert.deepStrictEqual(res.completions, ['ai21-response'])
    assert.equal(res.finishReason, 'done')
    assert.deepStrictEqual(res.headers, ctx.nr.response.response.headers)
    assert.equal(res.id, 'ai21-response-1')
    assert.equal(res.requestId, 'aws-request-1')
    assert.equal(res.statusCode, 200)
  })

  await t.test('claude malformed responses work', async (ctx) => {
    ctx.nr.bedrockCommand.isClaude = () => true
    const res = new BedrockResponse(ctx.nr)
    assert.deepStrictEqual(res.completions, [])
    assert.equal(res.finishReason, undefined)
    assert.deepStrictEqual(res.headers, ctx.nr.response.response.headers)
    assert.equal(res.id, undefined)
    assert.equal(res.requestId, 'aws-request-1')
    assert.equal(res.statusCode, 200)
  })

  await t.test('claude complete responses work', async (ctx) => {
    ctx.nr.bedrockCommand.isClaude = () => true
    ctx.nr.updatePayload(structuredClone(claude))
    const res = new BedrockResponse(ctx.nr)
    assert.deepStrictEqual(res.completions, ['claude-response'])
    assert.equal(res.finishReason, 'done')
    assert.deepStrictEqual(res.headers, ctx.nr.response.response.headers)
    assert.equal(res.id, undefined)
    assert.equal(res.requestId, 'aws-request-1')
    assert.equal(res.statusCode, 200)
  })

  await t.test('cohere malformed responses work', async (ctx) => {
    ctx.nr.bedrockCommand.isCohere = () => true
    const res = new BedrockResponse(ctx.nr)
    assert.deepStrictEqual(res.completions, [])
    assert.equal(res.finishReason, undefined)
    assert.deepStrictEqual(res.headers, ctx.nr.response.response.headers)
    assert.equal(res.id, undefined)
    assert.equal(res.requestId, 'aws-request-1')
    assert.equal(res.statusCode, 200)
  })

  await t.test('cohere complete responses work', async (ctx) => {
    ctx.nr.bedrockCommand.isCohere = () => true
    ctx.nr.updatePayload(structuredClone(cohere))
    const res = new BedrockResponse(ctx.nr)
    assert.deepStrictEqual(res.completions, ['cohere-response'])
    assert.equal(res.finishReason, 'done')
    assert.deepStrictEqual(res.headers, ctx.nr.response.response.headers)
    assert.equal(res.id, 'cohere-response-1')
    assert.equal(res.requestId, 'aws-request-1')
    assert.equal(res.statusCode, 200)
  })

  await t.test('llama malformed responses work', async (ctx) => {
    ctx.nr.bedrockCommand.isLlama = () => true
    const res = new BedrockResponse(ctx.nr)
    assert.deepStrictEqual(res.completions, [])
    assert.equal(res.finishReason, undefined)
    assert.deepStrictEqual(res.headers, ctx.nr.response.response.headers)
    assert.equal(res.id, undefined)
    assert.equal(res.requestId, 'aws-request-1')
    assert.equal(res.statusCode, 200)
  })

  await t.test('llama complete responses work', async (ctx) => {
    ctx.nr.bedrockCommand.isLlama = () => true
    ctx.nr.updatePayload(structuredClone(llama))
    const res = new BedrockResponse(ctx.nr)
    assert.deepStrictEqual(res.completions, ['llama-response'])
    assert.equal(res.finishReason, 'done')
    assert.deepStrictEqual(res.headers, ctx.nr.response.response.headers)
    assert.equal(res.id, undefined)
    assert.equal(res.requestId, 'aws-request-1')
    assert.equal(res.statusCode, 200)
  })

  await t.test('titan malformed responses work', async (ctx) => {
    ctx.nr.bedrockCommand.isTitan = () => true
    const res = new BedrockResponse(ctx.nr)
    assert.deepStrictEqual(res.completions, [])
    assert.equal(res.finishReason, undefined)
    assert.deepStrictEqual(res.headers, ctx.nr.response.response.headers)
    assert.equal(res.id, undefined)
    assert.equal(res.requestId, 'aws-request-1')
    assert.equal(res.statusCode, 200)
  })

  await t.test('titan complete responses work', async (ctx) => {
    ctx.nr.bedrockCommand.isTitan = () => true
    ctx.nr.updatePayload(structuredClone(titan))
    const res = new BedrockResponse(ctx.nr)
    assert.deepStrictEqual(res.completions, ['titan-response'])
    assert.equal(res.finishReason, 'done')
    assert.deepStrictEqual(res.headers, ctx.nr.response.response.headers)
    assert.equal(res.id, undefined)
    assert.equal(res.requestId, 'aws-request-1')
    assert.equal(res.statusCode, 200)
  })

  await t.test('should only set data from raw response on error', (ctx) => {
    ctx.nr.response.$response = { ...ctx.nr.response.response }
    delete ctx.nr.response.response
    delete ctx.nr.response.output
    ctx.nr.isError = true
    const res = new BedrockResponse(ctx.nr)
    assert.deepStrictEqual(res.completions, [])
    assert.equal(res.id, undefined)
    assert.equal(res.finishReason, undefined)
    assert.deepStrictEqual(res.headers, ctx.nr.response.$response.headers)
    assert.equal(res.requestId, 'aws-request-1')
    assert.equal(res.statusCode, 200)
  })
})
