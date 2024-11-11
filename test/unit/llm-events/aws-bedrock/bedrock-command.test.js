/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const structuredClone = require('./clone')
const BedrockCommand = require('../../../../lib/llm-events/aws-bedrock/bedrock-command')

const ai21 = {
  modelId: 'ai21.j2-mid-v1',
  body: {
    prompt: 'who are you'
  }
}

const claude = {
  modelId: 'anthropic.claude-v1',
  body: {
    prompt: '\n\nHuman: yes\n\nAssistant:'
  }
}

const claude35 = {
  modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
  body: {
    messages: [{ role: 'user', content: { type: 'text', text: 'who are you' } }]
  }
}

const claude3 = {
  modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
  body: {
    messages: [{ content: 'who are you' }]
  }
}

const cohere = {
  modelId: 'cohere.command-text-v14',
  body: {
    prompt: 'who are you'
  }
}

const cohereEmbed = {
  modelId: 'cohere.embed-english-v3',
  body: {
    texts: ['who', 'are', 'you'],
    input_type: 'search_document'
  }
}

const llama2 = {
  modelId: 'meta.llama2-13b-chat-v1',
  body: {
    prompt: 'who are you'
  }
}

const llama3 = {
  modelId: 'meta.llama3-8b-instruct-v1:0',
  body: {
    prompt: 'who are you'
  }
}

const titan = {
  modelId: 'amazon.titan-text-lite-v1',
  body: {
    inputText: 'who are you'
  }
}

const titanEmbed = {
  modelId: 'amazon.titan-embed-text-v1',
  body: {
    inputText: 'who are you'
  }
}

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.input = {
    body: JSON.stringify('{"foo":"foo"}')
  }

  ctx.nr.updatePayload = (payload) => {
    ctx.nr.input.modelId = payload.modelId
    ctx.nr.input.body = JSON.stringify(payload.body)
  }
})

test('non-conforming command is handled gracefully', async (t) => {
  const cmd = new BedrockCommand(t.nr.input)
  for (const model of [
    'Ai21',
    'Claude',
    'Claude3',
    'Cohere',
    'CohereEmbed',
    'Llama',
    'Titan',
    'TitanEmbed'
  ]) {
    assert.equal(cmd[`is${model}`](), false)
  }
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, '')
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, undefined)
  assert.equal(cmd.temperature, undefined)
})

test('ai21 minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(ai21))
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isAi21(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, ai21.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, ai21.body.prompt)
  assert.equal(cmd.temperature, undefined)
})

test('ai21 complete command works', async (t) => {
  const payload = structuredClone(ai21)
  payload.body.maxTokens = 25
  payload.body.temperature = 0.5
  t.nr.updatePayload(payload)
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isAi21(), true)
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.modelId, payload.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, payload.body.prompt)
  assert.equal(cmd.temperature, payload.body.temperature)
})

test('claude minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(claude))
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isClaude(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, claude.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, claude.body.prompt)
  assert.equal(cmd.temperature, undefined)
})

test('claude complete command works', async (t) => {
  const payload = structuredClone(claude)
  payload.body.max_tokens_to_sample = 25
  payload.body.temperature = 0.5
  t.nr.updatePayload(payload)
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isClaude(), true)
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.modelId, payload.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, payload.body.prompt)
  assert.equal(cmd.temperature, payload.body.temperature)
})

test('claude3 minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(claude3))
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isClaude3(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, claude3.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, claude3.body.messages[0].content)
  assert.equal(cmd.temperature, undefined)
})

test('claude3 complete command works', async (t) => {
  const payload = structuredClone(claude3)
  payload.body.max_tokens = 25
  payload.body.temperature = 0.5
  t.nr.updatePayload(payload)
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isClaude3(), true)
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.modelId, payload.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, payload.body.messages[0].content)
  assert.equal(cmd.temperature, payload.body.temperature)
})

test('claude35 minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(claude35))
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isClaude3(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, claude35.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, claude35.body.messages[0].content.text)
  assert.equal(cmd.temperature, undefined)
})

test('claude35 complete command works', async (t) => {
  const payload = structuredClone(claude35)
  payload.body.max_tokens = 25
  payload.body.temperature = 0.5
  t.nr.updatePayload(payload)
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isClaude3(), true)
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.modelId, payload.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, payload.body.messages[0].content.text)
  assert.equal(cmd.temperature, payload.body.temperature)
})
test('cohere minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(cohere))
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isCohere(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, cohere.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, cohere.body.prompt)
  assert.equal(cmd.temperature, undefined)
})

test('cohere complete command works', async (t) => {
  const payload = structuredClone(cohere)
  payload.body.max_tokens = 25
  payload.body.temperature = 0.5
  t.nr.updatePayload(payload)
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isCohere(), true)
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.modelId, payload.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, payload.body.prompt)
  assert.equal(cmd.temperature, payload.body.temperature)
})

test('cohere embed minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(cohereEmbed))
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isCohereEmbed(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, cohereEmbed.modelId)
  assert.equal(cmd.modelType, 'embedding')
  assert.deepStrictEqual(cmd.prompt, cohereEmbed.body.texts.join(' '))
  assert.equal(cmd.temperature, undefined)
})

test('llama2 minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(llama2))
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isLlama(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, llama2.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, llama2.body.prompt)
  assert.equal(cmd.temperature, undefined)
})

test('llama2 complete command works', async (t) => {
  const payload = structuredClone(llama2)
  payload.body.max_gen_length = 25
  payload.body.temperature = 0.5
  t.nr.updatePayload(payload)
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isLlama(), true)
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.modelId, payload.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, payload.body.prompt)
  assert.equal(cmd.temperature, payload.body.temperature)
})

test('llama3 minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(llama3))
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isLlama(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, llama3.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, llama3.body.prompt)
  assert.equal(cmd.temperature, undefined)
})

test('llama3 complete command works', async (t) => {
  const payload = structuredClone(llama3)
  payload.body.max_gen_length = 25
  payload.body.temperature = 0.5
  t.nr.updatePayload(payload)
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isLlama(), true)
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.modelId, payload.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, payload.body.prompt)
  assert.equal(cmd.temperature, payload.body.temperature)
})

test('titan minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(titan))
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isTitan(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, titan.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, titan.body.inputText)
  assert.equal(cmd.temperature, undefined)
})

test('titan complete command works', async (t) => {
  const payload = structuredClone(titan)
  payload.body.textGenerationConfig = {
    maxTokenCount: 25,
    temperature: 0.5
  }
  t.nr.updatePayload(payload)
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isTitan(), true)
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.modelId, payload.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.equal(cmd.prompt, payload.body.inputText)
  assert.equal(cmd.temperature, payload.body.textGenerationConfig.temperature)
})

test('titan embed minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(titanEmbed))
  const cmd = new BedrockCommand(t.nr.input)
  assert.equal(cmd.isTitanEmbed(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, titanEmbed.modelId)
  assert.equal(cmd.modelType, 'embedding')
  assert.equal(cmd.prompt, titanEmbed.body.inputText)
  assert.equal(cmd.temperature, undefined)
})
