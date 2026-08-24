/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const structuredClone = require('./clone')
const InvokeModelCommand = require('../../../../lib/llm-events/aws-bedrock/invoke-model-command')

const claudePromptApi = {
  // The body.prompt field only existed for v1 and v2 Claude models.
  modelId: 'anthropic.claude-v1',
  body: {
    prompt: '\n\nHuman: yes\n\nAssistant:'
  }
}
const regionClaudePromptApi = { ...claudePromptApi, modelId: `us.${claudePromptApi.modelId}` }

const claudeMsgsApi = {
  // The specific modelId (v3, v4, or v5) doesn't matter here as long as
  // it is prefixed with 'anthropic.claude' and the body.messages field exists.
  modelId: 'anthropic.claude-opus-5-20260601-v1:0',
  body: {
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'who are' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'researching' }] },
      { role: 'user', content: [{ type: 'text', text: 'you' }] }
    ]
  }
}
const regionClaudeMsgsApi = { ...claudeMsgsApi, modelId: `us.${claudeMsgsApi.modelId}` }

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
  const cmd = new InvokeModelCommand(t.nr.input)
  for (const model of [
    'ClaudePromptApi',
    'ClaudeMessagesApi',
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
  assert.deepEqual(cmd.prompt, [])
  assert.equal(cmd.temperature, undefined)
})

test('claude minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(claudePromptApi))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudePromptApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, claudePromptApi.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: claudePromptApi.body.prompt }])
  assert.equal(cmd.temperature, undefined)
})

test('region specific claude minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(regionClaudePromptApi))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudePromptApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, regionClaudePromptApi.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: claudePromptApi.body.prompt }])
  assert.equal(cmd.temperature, undefined)
})

test('claude complete command works', async (t) => {
  const payload = structuredClone(claudePromptApi)
  payload.body.max_tokens_to_sample = 25
  payload.body.temperature = 0.5
  t.nr.updatePayload(payload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudePromptApi(), true)
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.modelId, payload.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: payload.body.prompt }])
  assert.equal(cmd.temperature, payload.body.temperature)
})

test('region specific claude complete command works', async (t) => {
  const payload = structuredClone(regionClaudePromptApi)
  payload.body.max_tokens_to_sample = 25
  payload.body.temperature = 0.5
  t.nr.updatePayload(payload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudePromptApi(), true)
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.modelId, payload.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: payload.body.prompt }])
  assert.equal(cmd.temperature, payload.body.temperature)
})

test('claude opus 5 command is detected via modelId', async (t) => {
  t.nr.updatePayload({ modelId: 'anthropic.claude-opus-5-20260601-v1:0', body: {} })
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
})

test('claude prompt api modelId is not mistaken for the messages api', async (t) => {
  const payload = structuredClone(claudePromptApi)
  payload.body = {}
  t.nr.updatePayload(payload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), false)
})

test('claudeMsgsApi malformed payload produces reasonable values', async (t) => {
  const malformedPayload = structuredClone(claudeMsgsApi)
  malformedPayload.body = {}
  t.nr.updatePayload(malformedPayload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, claudeMsgsApi.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [])
  assert.equal(cmd.temperature, undefined)
})

test('region specific claudeMsgsApi malformed payload produces reasonable values', async (t) => {
  const malformedPayload = structuredClone(regionClaudeMsgsApi)
  malformedPayload.body = {}
  t.nr.updatePayload(malformedPayload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, regionClaudeMsgsApi.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [])
  assert.equal(cmd.temperature, undefined)
})

test('claudeMsgsApi skips a message that is null in `body.messages`', async (t) => {
  const malformedPayload = structuredClone(claudeMsgsApi)
  malformedPayload.body.messages = [{ role: 'user', content: 'who are you' }, null]
  t.nr.updatePayload(malformedPayload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: 'who are you' }])
})

test('region specific claudeMsgsApi skips a message that is null in `body.messages`', async (t) => {
  const malformedPayload = structuredClone(regionClaudeMsgsApi)
  malformedPayload.body.messages = [{ role: 'user', content: 'who are you' }, null]
  t.nr.updatePayload(malformedPayload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: 'who are you' }])
})

test('claudeMsgsApi handles defaulting prompt to empty array when `body.messages` is null', async (t) => {
  const malformedPayload = structuredClone(claudeMsgsApi)
  malformedPayload.body.messages = null
  t.nr.updatePayload(malformedPayload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.deepEqual(cmd.prompt, [])
})

test('region specific claudeMsgsApi handles defaulting prompt to empty array when `body.messages` is null', async (t) => {
  const malformedPayload = structuredClone(regionClaudeMsgsApi)
  malformedPayload.body.messages = null
  t.nr.updatePayload(malformedPayload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.deepEqual(cmd.prompt, [])
})

test('claudeMsgsApi minimal command works with string content', async (t) => {
  const payload = structuredClone(claudeMsgsApi)
  payload.body.messages = [{ role: 'user', content: 'who are you' }]
  t.nr.updatePayload(payload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, claudeMsgsApi.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, payload.body.messages)
  assert.equal(cmd.temperature, undefined)
})

test('claudeMsgsApi minimal command works with chunked content', async (t) => {
  t.nr.updatePayload(structuredClone(claudeMsgsApi))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, claudeMsgsApi.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: 'who are' }, { role: 'assistant', content: 'researching' }, { role: 'user', content: 'you' }])
  assert.equal(cmd.temperature, undefined)
})

test('region specific claudeMsgsApi minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(regionClaudeMsgsApi))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, regionClaudeMsgsApi.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: 'who are' }, { role: 'assistant', content: 'researching' }, { role: 'user', content: 'you' }])
  assert.equal(cmd.temperature, undefined)
})

test('claudeMsgsApi complete command works', async (t) => {
  const payload = structuredClone(claudeMsgsApi)
  payload.body.max_tokens = 25
  payload.body.temperature = 0.5
  t.nr.updatePayload(payload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.modelId, payload.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: 'who are' }, { role: 'assistant', content: 'researching' }, { role: 'user', content: 'you' }])
  assert.equal(cmd.temperature, payload.body.temperature)
})

test('region specific claudeMsgsApi complete command works', async (t) => {
  const payload = structuredClone(regionClaudeMsgsApi)
  payload.body.max_tokens = 25
  payload.body.temperature = 0.5
  t.nr.updatePayload(payload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.modelId, payload.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: 'who are' }, { role: 'assistant', content: 'researching' }, { role: 'user', content: 'you' }])
  assert.equal(cmd.temperature, payload.body.temperature)
})

test('cohere minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(cohere))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isCohere(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, cohere.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: cohere.body.prompt }])
  assert.equal(cmd.temperature, undefined)
})

test('cohere complete command works', async (t) => {
  const payload = structuredClone(cohere)
  payload.body.max_tokens = 25
  payload.body.temperature = 0.5
  t.nr.updatePayload(payload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isCohere(), true)
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.modelId, payload.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: payload.body.prompt }])
  assert.equal(cmd.temperature, payload.body.temperature)
})

test('cohere embed minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(cohereEmbed))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isCohereEmbed(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, cohereEmbed.modelId)
  assert.equal(cmd.modelType, 'embedding')
  assert.deepStrictEqual(cmd.prompt, [{ role: 'user', content: cohereEmbed.body.texts.join(' ') }])
  assert.equal(cmd.temperature, undefined)
})

test('llama3 minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(llama3))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isLlama(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, llama3.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: llama3.body.prompt }])
  assert.equal(cmd.temperature, undefined)
})

test('llama3 complete command works', async (t) => {
  const payload = structuredClone(llama3)
  payload.body.max_gen_length = 25
  payload.body.temperature = 0.5
  t.nr.updatePayload(payload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isLlama(), true)
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.modelId, payload.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: payload.body.prompt }])
  assert.equal(cmd.temperature, payload.body.temperature)
})

test('titan minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(titan))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isTitan(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, titan.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: titan.body.inputText }])
  assert.equal(cmd.temperature, undefined)
})

test('titan complete command works', async (t) => {
  const payload = structuredClone(titan)
  payload.body.textGenerationConfig = {
    maxTokenCount: 25,
    temperature: 0.5
  }
  t.nr.updatePayload(payload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isTitan(), true)
  assert.equal(cmd.maxTokens, 25)
  assert.equal(cmd.modelId, payload.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: payload.body.inputText }])
  assert.equal(cmd.temperature, payload.body.textGenerationConfig.temperature)
})

test('titan embed minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(titanEmbed))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isTitanEmbed(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, titanEmbed.modelId)
  assert.equal(cmd.modelType, 'embedding')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: titanEmbed.body.inputText }])
  assert.equal(cmd.temperature, undefined)
})
