/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
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

tap.beforeEach((t) => {
  t.context.input = {
    body: JSON.stringify('{"foo":"foo"}')
  }

  t.context.updatePayload = (payload) => {
    t.context.input.modelId = payload.modelId
    t.context.input.body = JSON.stringify(payload.body)
  }
})

tap.test('non-conforming command is handled gracefully', async (t) => {
  const cmd = new BedrockCommand(t.context.input)
  for (const model of [
    'Ai21',
    'Claude',
    'Claude3',
    'Cohere',
    'CohereEmbed',
    'Llama2',
    'Titan',
    'TitanEmbed'
  ]) {
    t.equal(cmd[`is${model}`](), false)
  }
  t.equal(cmd.maxTokens, undefined)
  t.equal(cmd.modelId, '')
  t.equal(cmd.modelType, 'completion')
  t.equal(cmd.prompt, undefined)
  t.equal(cmd.temperature, undefined)
})

tap.test('ai21 minimal command works', async (t) => {
  t.context.updatePayload(structuredClone(ai21))
  const cmd = new BedrockCommand(t.context.input)
  t.equal(cmd.isAi21(), true)
  t.equal(cmd.maxTokens, undefined)
  t.equal(cmd.modelId, ai21.modelId)
  t.equal(cmd.modelType, 'completion')
  t.equal(cmd.prompt, ai21.body.prompt)
  t.equal(cmd.temperature, undefined)
})

tap.test('ai21 complete command works', async (t) => {
  const payload = structuredClone(ai21)
  payload.body.maxTokens = 25
  payload.body.temperature = 0.5
  t.context.updatePayload(payload)
  const cmd = new BedrockCommand(t.context.input)
  t.equal(cmd.isAi21(), true)
  t.equal(cmd.maxTokens, 25)
  t.equal(cmd.modelId, payload.modelId)
  t.equal(cmd.modelType, 'completion')
  t.equal(cmd.prompt, payload.body.prompt)
  t.equal(cmd.temperature, payload.body.temperature)
})

tap.test('claude minimal command works', async (t) => {
  t.context.updatePayload(structuredClone(claude))
  const cmd = new BedrockCommand(t.context.input)
  t.equal(cmd.isClaude(), true)
  t.equal(cmd.maxTokens, undefined)
  t.equal(cmd.modelId, claude.modelId)
  t.equal(cmd.modelType, 'completion')
  t.equal(cmd.prompt, claude.body.prompt)
  t.equal(cmd.temperature, undefined)
})

tap.test('claude complete command works', async (t) => {
  const payload = structuredClone(claude)
  payload.body.max_tokens_to_sample = 25
  payload.body.temperature = 0.5
  t.context.updatePayload(payload)
  const cmd = new BedrockCommand(t.context.input)
  t.equal(cmd.isClaude(), true)
  t.equal(cmd.maxTokens, 25)
  t.equal(cmd.modelId, payload.modelId)
  t.equal(cmd.modelType, 'completion')
  t.equal(cmd.prompt, payload.body.prompt)
  t.equal(cmd.temperature, payload.body.temperature)
})

tap.test('claude3 minimal command works', async (t) => {
  t.context.updatePayload(structuredClone(claude3))
  const cmd = new BedrockCommand(t.context.input)
  t.equal(cmd.isClaude3(), true)
  t.equal(cmd.maxTokens, undefined)
  t.equal(cmd.modelId, claude3.modelId)
  t.equal(cmd.modelType, 'completion')
  t.equal(cmd.prompt, claude3.body.messages[0].content)
  t.equal(cmd.temperature, undefined)
})

tap.test('claude3 complete command works', async (t) => {
  const payload = structuredClone(claude3)
  payload.body.max_tokens = 25
  payload.body.temperature = 0.5
  t.context.updatePayload(payload)
  const cmd = new BedrockCommand(t.context.input)
  t.equal(cmd.isClaude3(), true)
  t.equal(cmd.maxTokens, 25)
  t.equal(cmd.modelId, payload.modelId)
  t.equal(cmd.modelType, 'completion')
  t.equal(cmd.prompt, payload.body.messages[0].content)
  t.equal(cmd.temperature, payload.body.temperature)
})

tap.test('cohere minimal command works', async (t) => {
  t.context.updatePayload(structuredClone(cohere))
  const cmd = new BedrockCommand(t.context.input)
  t.equal(cmd.isCohere(), true)
  t.equal(cmd.maxTokens, undefined)
  t.equal(cmd.modelId, cohere.modelId)
  t.equal(cmd.modelType, 'completion')
  t.equal(cmd.prompt, cohere.body.prompt)
  t.equal(cmd.temperature, undefined)
})

tap.test('cohere complete command works', async (t) => {
  const payload = structuredClone(cohere)
  payload.body.max_tokens = 25
  payload.body.temperature = 0.5
  t.context.updatePayload(payload)
  const cmd = new BedrockCommand(t.context.input)
  t.equal(cmd.isCohere(), true)
  t.equal(cmd.maxTokens, 25)
  t.equal(cmd.modelId, payload.modelId)
  t.equal(cmd.modelType, 'completion')
  t.equal(cmd.prompt, payload.body.prompt)
  t.equal(cmd.temperature, payload.body.temperature)
})

tap.test('cohere embed minimal command works', async (t) => {
  t.context.updatePayload(structuredClone(cohereEmbed))
  const cmd = new BedrockCommand(t.context.input)
  t.equal(cmd.isCohereEmbed(), true)
  t.equal(cmd.maxTokens, undefined)
  t.equal(cmd.modelId, cohereEmbed.modelId)
  t.equal(cmd.modelType, 'embedding')
  t.same(cmd.prompt, cohereEmbed.body.texts.join(' '))
  t.equal(cmd.temperature, undefined)
})

tap.test('llama2 minimal command works', async (t) => {
  t.context.updatePayload(structuredClone(llama2))
  const cmd = new BedrockCommand(t.context.input)
  t.equal(cmd.isLlama2(), true)
  t.equal(cmd.maxTokens, undefined)
  t.equal(cmd.modelId, llama2.modelId)
  t.equal(cmd.modelType, 'completion')
  t.equal(cmd.prompt, llama2.body.prompt)
  t.equal(cmd.temperature, undefined)
})

tap.test('llama2 complete command works', async (t) => {
  const payload = structuredClone(llama2)
  payload.body.max_gen_length = 25
  payload.body.temperature = 0.5
  t.context.updatePayload(payload)
  const cmd = new BedrockCommand(t.context.input)
  t.equal(cmd.isLlama2(), true)
  t.equal(cmd.maxTokens, 25)
  t.equal(cmd.modelId, payload.modelId)
  t.equal(cmd.modelType, 'completion')
  t.equal(cmd.prompt, payload.body.prompt)
  t.equal(cmd.temperature, payload.body.temperature)
})

tap.test('titan minimal command works', async (t) => {
  t.context.updatePayload(structuredClone(titan))
  const cmd = new BedrockCommand(t.context.input)
  t.equal(cmd.isTitan(), true)
  t.equal(cmd.maxTokens, undefined)
  t.equal(cmd.modelId, titan.modelId)
  t.equal(cmd.modelType, 'completion')
  t.equal(cmd.prompt, titan.body.inputText)
  t.equal(cmd.temperature, undefined)
})

tap.test('titan complete command works', async (t) => {
  const payload = structuredClone(titan)
  payload.body.textGenerationConfig = {
    maxTokenCount: 25,
    temperature: 0.5
  }
  t.context.updatePayload(payload)
  const cmd = new BedrockCommand(t.context.input)
  t.equal(cmd.isTitan(), true)
  t.equal(cmd.maxTokens, 25)
  t.equal(cmd.modelId, payload.modelId)
  t.equal(cmd.modelType, 'completion')
  t.equal(cmd.prompt, payload.body.inputText)
  t.equal(cmd.temperature, payload.body.textGenerationConfig.temperature)
})

tap.test('titan embed minimal command works', async (t) => {
  t.context.updatePayload(structuredClone(titanEmbed))
  const cmd = new BedrockCommand(t.context.input)
  t.equal(cmd.isTitanEmbed(), true)
  t.equal(cmd.maxTokens, undefined)
  t.equal(cmd.modelId, titanEmbed.modelId)
  t.equal(cmd.modelType, 'embedding')
  t.equal(cmd.prompt, titanEmbed.body.inputText)
  t.equal(cmd.temperature, undefined)
})
