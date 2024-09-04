/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const {
  BedrockCommand,
  BedrockResponse,
  StreamHandler
} = require('../../../../lib/llm-events/aws-bedrock')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.response = {
    response: {
      headers: {
        'x-amzn-requestid': 'aws-req-1'
      },
      statusCode: 200
    },
    output: {
      body: {}
    }
  }

  ctx.nr.passThroughParams = {
    response: ctx.nr.response,
    segment: {
      touch() {
        assert.ok(true)
      }
    },
    bedrockCommand: {
      isCohere() {
        return false
      },
      isCohereEmbed() {
        return false
      },
      isClaude() {
        return false
      },
      isClaude3() {
        return false
      },
      isLlama() {
        return false
      },
      isTitan() {
        return false
      }
    }
  }

  ctx.nr.onComplete = (params) => {
    assert.deepStrictEqual(params, ctx.nr.passThroughParams)
  }

  ctx.nr.chunks = [{ foo: 'foo' }]

  /* eslint-disable prettier/prettier */ // It doesn't like the IIFE syntax
  ctx.nr.stream = (async function* originalStream() {
    const encoder = new TextEncoder()
    for (const chunk of ctx.nr.chunks) {
      const json = JSON.stringify(chunk)
      const bytes = encoder.encode(json)
      yield { chunk: { bytes } }
    }
  }())
  /* eslint-enable prettier/prettier */
})

test('unrecognized or unhandled model uses original stream', async (t) => {
  t.nr.modelId = 'amazon.titan-embed-text-v1'
  const handler = new StreamHandler(t.nr)
  assert.equal(handler.generator.name, undefined)
  assert.equal(handler.generator, t.nr.stream)
})

test('handles claude streams', async (t) => {
  t.nr.passThroughParams.bedrockCommand.isClaude = () => true
  t.nr.chunks = [
    { completion: '1', stop_reason: null },
    { completion: '2', stop_reason: 'done', ...t.nr.metrics }
  ]
  const handler = new StreamHandler(t.nr)

  assert.equal(handler.generator.name, 'handleClaude')
  for await (const event of handler.generator()) {
    assert.equal(event.chunk.bytes.constructor, Uint8Array)
  }
  assert.deepStrictEqual(handler.response, {
    response: {
      headers: {
        'x-amzn-requestid': 'aws-req-1'
      },
      statusCode: 200
    },
    output: {
      body: new TextEncoder().encode(JSON.stringify({ completion: '12', stop_reason: 'done' }))
    }
  })

  const bc = new BedrockCommand({
    modelId: 'anthropic.claude-v1',
    body: JSON.stringify({
      prompt: 'prompt',
      maxTokens: 5
    })
  })
  const br = new BedrockResponse({ bedrockCommand: bc, response: handler.response })
  assert.equal(br.completions.length, 1)
  assert.equal(br.finishReason, 'done')
  assert.equal(br.requestId, 'aws-req-1')
  assert.equal(br.statusCode, 200)
})

test('handles claude3streams', async (t) => {
  t.nr.passThroughParams.bedrockCommand.isClaude3 = () => true
  t.nr.chunks = [
    { type: 'content_block_delta', delta: { type: 'text_delta', text: '42' } },
    { type: 'message_delta', delta: { stop_reason: 'done' } },
    { type: 'message_stop', ...t.nr.metrics }
  ]
  const handler = new StreamHandler(t.nr)

  assert.equal(handler.generator.name, 'handleClaude3')
  for await (const event of handler.generator()) {
    assert.equal(event.chunk.bytes.constructor, Uint8Array)
  }
  const foundBody = JSON.parse(new TextDecoder().decode(handler.response.output.body))
  assert.deepStrictEqual(foundBody, {
    completions: ['42'],
    stop_reason: 'done',
    type: 'message_stop'
  })

  const bc = new BedrockCommand({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    body: JSON.stringify({
      messages: [{ content: 'prompt' }],
      maxTokens: 5
    })
  })
  const br = new BedrockResponse({ bedrockCommand: bc, response: handler.response })
  assert.equal(br.completions.length, 1)
  assert.equal(br.finishReason, 'done')
  assert.equal(br.requestId, 'aws-req-1')
  assert.equal(br.statusCode, 200)
})

test('handles cohere streams', async (t) => {
  t.nr.passThroughParams.bedrockCommand.isCohere = () => true
  t.nr.chunks = [
    { generations: [{ text: '1', finish_reason: null }] },
    { generations: [{ text: '2', finish_reason: 'done' }], ...t.nr.metrics }
  ]
  const handler = new StreamHandler(t.nr)

  assert.equal(handler.generator.name, 'handleCohere')
  for await (const event of handler.generator()) {
    assert.equal(event.chunk.bytes.constructor, Uint8Array)
  }
  assert.deepStrictEqual(handler.response, {
    response: {
      headers: {
        'x-amzn-requestid': 'aws-req-1'
      },
      statusCode: 200
    },
    output: {
      body: new TextEncoder().encode(
        JSON.stringify({
          generations: [
            { text: '1', finish_reason: null },
            { text: '2', finish_reason: 'done' }
          ]
        })
      )
    }
  })

  const bc = new BedrockCommand({
    modelId: 'cohere.',
    body: JSON.stringify({
      texts: ['prompt'],
      max_tokens: 5
    })
  })
  const br = new BedrockResponse({ bedrockCommand: bc, response: handler.response })
  assert.equal(br.completions.length, 2)
  assert.equal(br.finishReason, 'done')
  assert.equal(br.requestId, 'aws-req-1')
  assert.equal(br.statusCode, 200)
})

test('handles cohere embedding streams', async (t) => {
  t.nr.passThroughParams.bedrockCommand.isCohereEmbed = () => true
  t.nr.chunks = [
    {
      embeddings: [
        [1, 2],
        [3, 4]
      ],
      ...t.nr.metrics
    }
  ]
  const handler = new StreamHandler(t.nr)

  assert.equal(handler.generator.name, 'handleCohereEmbed')
  for await (const event of handler.generator()) {
    assert.equal(event.chunk.bytes.constructor, Uint8Array)
  }
  assert.deepStrictEqual(handler.response, {
    response: {
      headers: {
        'x-amzn-requestid': 'aws-req-1'
      },
      statusCode: 200
    },
    output: {
      body: new TextEncoder().encode(
        JSON.stringify({
          embeddings: [
            [1, 2],
            [3, 4]
          ]
        })
      )
    }
  })

  const bc = new BedrockCommand({
    modelId: 'cohere.',
    body: JSON.stringify({
      texts: ['prompt'],
      max_tokens: 5
    })
  })
  const br = new BedrockResponse({ bedrockCommand: bc, response: handler.response })
  assert.equal(br.completions.length, 0)
  assert.equal(br.finishReason, undefined)
  assert.equal(br.requestId, 'aws-req-1')
  assert.equal(br.statusCode, 200)
})

test('handles llama streams', async (t) => {
  t.nr.passThroughParams.bedrockCommand.isLlama = () => true
  t.nr.chunks = [
    { generation: '1', stop_reason: null },
    { generation: '2', stop_reason: 'done', ...t.nr.metrics }
  ]
  const handler = new StreamHandler(t.nr)

  assert.equal(handler.generator.name, 'handleLlama')
  for await (const event of handler.generator()) {
    assert.equal(event.chunk.bytes.constructor, Uint8Array)
  }
  assert.deepStrictEqual(handler.response, {
    response: {
      headers: {
        'x-amzn-requestid': 'aws-req-1'
      },
      statusCode: 200
    },
    output: {
      body: new TextEncoder().encode(JSON.stringify({ generation: '12', stop_reason: 'done' }))
    }
  })

  const bc = new BedrockCommand({
    modelId: 'meta.llama',
    body: JSON.stringify({
      prompt: 'prompt',
      max_gen_length: 5
    })
  })
  const br = new BedrockResponse({ bedrockCommand: bc, response: handler.response })
  assert.equal(br.completions.length, 1)
  assert.equal(br.finishReason, 'done')
  assert.equal(br.requestId, 'aws-req-1')
  assert.equal(br.statusCode, 200)
})

test('handles titan streams', async (t) => {
  t.nr.passThroughParams.bedrockCommand.isTitan = () => true
  t.nr.chunks = [
    { outputText: '1', completionReason: null },
    { outputText: '2', completionReason: 'done', ...t.nr.metrics }
  ]
  const handler = new StreamHandler(t.nr)

  assert.equal(handler.generator.name, 'handleTitan')
  for await (const event of handler.generator()) {
    assert.equal(event.chunk.bytes.constructor, Uint8Array)
  }
  assert.deepStrictEqual(handler.response, {
    response: {
      headers: {
        'x-amzn-requestid': 'aws-req-1'
      },
      statusCode: 200
    },
    output: {
      body: new TextEncoder().encode(
        JSON.stringify({
          results: [
            { outputText: '1', completionReason: null },
            { outputText: '2', completionReason: 'done' }
          ]
        })
      )
    }
  })

  const bc = new BedrockCommand({
    modelId: 'amazon.titan',
    body: JSON.stringify({
      inputText: 'prompt',
      textGenerationConfig: {
        maxTokenCount: 5,
        temperature: 0.5
      }
    })
  })
  const br = new BedrockResponse({ bedrockCommand: bc, response: handler.response })
  assert.equal(br.completions.length, 2)
  assert.equal(br.finishReason, 'done')
  assert.equal(br.requestId, 'aws-req-1')
  assert.equal(br.statusCode, 200)
})
