/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const {
  BedrockCommand,
  BedrockResponse,
  StreamHandler
} = require('../../../../lib/llm-events/aws-bedrock')

tap.beforeEach((t) => {
  t.context.response = {
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

  t.context.passThroughParams = {
    response: t.context.response,
    segment: {
      touch() {
        t.pass()
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
      isLlama2() {
        return false
      },
      isTitan() {
        return false
      }
    }
  }

  t.context.onComplete = (params) => {
    t.same(params, t.context.passThroughParams)
  }

  t.context.chunks = [{ foo: 'foo' }]

  /* eslint-disable prettier/prettier */ // It doesn't like the IIFE syntax
  t.context.stream = (async function* originalStream() {
    const encoder = new TextEncoder()
    for (const chunk of t.context.chunks) {
      const json = JSON.stringify(chunk)
      const bytes = encoder.encode(json)
      yield { chunk: { bytes } }
    }
  }())
  /* eslint-enable prettier/prettier */
})

tap.test('unrecognized or unhandled model uses original stream', async (t) => {
  t.context.modelId = 'amazon.titan-embed-text-v1'
  const handler = new StreamHandler(t.context)
  t.equal(handler.generator.name, undefined)
  t.equal(handler.generator, t.context.stream)
})

tap.test('handles claude streams', async (t) => {
  t.context.passThroughParams.bedrockCommand.isClaude = () => true
  t.context.chunks = [
    { completion: '1', stop_reason: null },
    { completion: '2', stop_reason: 'done', ...t.context.metrics }
  ]
  const handler = new StreamHandler(t.context)

  t.equal(handler.generator.name, 'handleClaude')
  for await (const event of handler.generator()) {
    t.type(event.chunk.bytes, Uint8Array)
  }
  t.same(handler.response, {
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
    modelId: 'anthropic.claude',
    body: JSON.stringify({
      prompt: 'prompt',
      maxTokens: 5
    })
  })
  const br = new BedrockResponse({ bedrockCommand: bc, response: handler.response })
  t.equal(br.completions.length, 1)
  t.equal(br.finishReason, 'done')
  t.equal(br.requestId, 'aws-req-1')
  t.equal(br.statusCode, 200)
})

tap.test('handles cohere streams', async (t) => {
  t.context.passThroughParams.bedrockCommand.isCohere = () => true
  t.context.chunks = [
    { generations: [{ text: '1', finish_reason: null }] },
    { generations: [{ text: '2', finish_reason: 'done' }], ...t.context.metrics }
  ]
  const handler = new StreamHandler(t.context)

  t.equal(handler.generator.name, 'handleCohere')
  for await (const event of handler.generator()) {
    t.type(event.chunk.bytes, Uint8Array)
  }
  t.same(handler.response, {
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
  t.equal(br.completions.length, 2)
  t.equal(br.finishReason, 'done')
  t.equal(br.requestId, 'aws-req-1')
  t.equal(br.statusCode, 200)
})

tap.test('handles cohere embedding streams', async (t) => {
  t.context.passThroughParams.bedrockCommand.isCohereEmbed = () => true
  t.context.chunks = [
    {
      embeddings: [
        [1, 2],
        [3, 4]
      ],
      ...t.context.metrics
    }
  ]
  const handler = new StreamHandler(t.context)

  t.equal(handler.generator.name, 'handleCohereEmbed')
  for await (const event of handler.generator()) {
    t.type(event.chunk.bytes, Uint8Array)
  }
  t.same(handler.response, {
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
  t.equal(br.completions.length, 0)
  t.equal(br.finishReason, undefined)
  t.equal(br.requestId, 'aws-req-1')
  t.equal(br.statusCode, 200)
})

tap.test('handles llama2 streams', async (t) => {
  t.context.passThroughParams.bedrockCommand.isLlama2 = () => true
  t.context.chunks = [
    { generation: '1', stop_reason: null },
    { generation: '2', stop_reason: 'done', ...t.context.metrics }
  ]
  const handler = new StreamHandler(t.context)

  t.equal(handler.generator.name, 'handleLlama2')
  for await (const event of handler.generator()) {
    t.type(event.chunk.bytes, Uint8Array)
  }
  t.same(handler.response, {
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
    modelId: 'meta.llama2',
    body: JSON.stringify({
      prompt: 'prompt',
      max_gen_length: 5
    })
  })
  const br = new BedrockResponse({ bedrockCommand: bc, response: handler.response })
  t.equal(br.completions.length, 1)
  t.equal(br.finishReason, 'done')
  t.equal(br.requestId, 'aws-req-1')
  t.equal(br.statusCode, 200)
})

tap.test('handles titan streams', async (t) => {
  t.context.passThroughParams.bedrockCommand.isTitan = () => true
  t.context.chunks = [
    { outputText: '1', completionReason: null },
    { outputText: '2', completionReason: 'done', ...t.context.metrics }
  ]
  const handler = new StreamHandler(t.context)

  t.equal(handler.generator.name, 'handleTitan')
  for await (const event of handler.generator()) {
    t.type(event.chunk.bytes, Uint8Array)
  }
  t.same(handler.response, {
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
  t.equal(br.completions.length, 2)
  t.equal(br.finishReason, 'done')
  t.equal(br.requestId, 'aws-req-1')
  t.equal(br.statusCode, 200)
})
