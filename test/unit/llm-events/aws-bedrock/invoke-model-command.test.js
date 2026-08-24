/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const structuredClone = require('./clone')
const InvokeModelCommand = require('../../../../lib/llm-events/aws-bedrock/invoke-model-command')

const claude = {
  modelId: 'anthropic.claude-v1',
  body: {
    prompt: '\n\nHuman: yes\n\nAssistant:'
  }
}

const regionClaude = {
  modelId: 'us.anthropic.claude-v1',
  body: {
    prompt: '\n\nHuman: yes\n\nAssistant:'
  }
}

const claude35 = {
  modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
  body: {
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'who are' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'researching' }] },
      { role: 'user', content: [{ type: 'text', text: 'you' }] }
    ]
  }
}

const regionClaude35 = {
  modelId: 'us.anthropic.claude-3-5-sonnet-20240620-v1:0',
  body: {
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'who are' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'researching' }] },
      { role: 'user', content: [{ type: 'text', text: 'you' }] }
    ]
  }
}
const claudeMsgsApi = {
  modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
  body: {
    messages: [{ role: 'user', content: 'who are you' }]
  }
}

const claudeOpus4 = {
  modelId: 'anthropic.claude-opus-4-1-20250805-v1:0',
  body: {
    messages: [{ role: 'user', content: 'who are you' }]
  }
}

const claudeSonnet45 = {
  modelId: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
  body: {
    messages: [{ role: 'user', content: 'who are you' }]
  }
}

const regionClaudeMsgsApi = {
  modelId: 'us.anthropic.claude-3-haiku-20240307-v1:0',
  body: {
    messages: [{ role: 'user', content: 'who are you' }]
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
  t.nr.updatePayload(structuredClone(claude))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudePromptApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, claude.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: claude.body.prompt }])
  assert.equal(cmd.temperature, undefined)
})

test('region specific claude minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(regionClaude))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudePromptApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, regionClaude.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: claude.body.prompt }])
  assert.equal(cmd.temperature, undefined)
})

test('claude complete command works', async (t) => {
  const payload = structuredClone(claude)
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
  const payload = structuredClone(regionClaude)
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

test('claudeMsgsApi minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(claudeMsgsApi))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, claudeMsgsApi.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, claudeMsgsApi.body.messages)
  assert.equal(cmd.temperature, undefined)
})

test('region specific claudeMsgsApi minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(regionClaudeMsgsApi))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, regionClaudeMsgsApi.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, claudeMsgsApi.body.messages)
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
  assert.deepEqual(cmd.prompt, payload.body.messages)
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
  assert.deepEqual(cmd.prompt, payload.body.messages)
  assert.equal(cmd.temperature, payload.body.temperature)
})

test('claude opus 4 command is detected via modelId', async (t) => {
  const payload = structuredClone(claudeOpus4)
  payload.body = {}
  t.nr.updatePayload(payload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
})

test('claude sonnet 4.5 command is detected via modelId', async (t) => {
  const payload = structuredClone(claudeSonnet45)
  payload.body = {}
  t.nr.updatePayload(payload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
})

test('claude prompt api modelId is not mistaken for the messages api', async (t) => {
  const payload = structuredClone(claude)
  payload.body = {}
  t.nr.updatePayload(payload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), false)
})

test('claude35 minimal command works with claude 3 api', async (t) => {
  t.nr.updatePayload(structuredClone(claudeMsgsApi))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, claudeMsgsApi.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, claudeMsgsApi.body.messages)
  assert.equal(cmd.temperature, undefined)
})

test('claude35 malformed payload produces reasonable values', async (t) => {
  const malformedPayload = structuredClone(claude35)
  malformedPayload.body = {}
  t.nr.updatePayload(malformedPayload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, claude35.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [])
  assert.equal(cmd.temperature, undefined)
})

test('region specific claude35 malformed payload produces reasonable values', async (t) => {
  const malformedPayload = structuredClone(regionClaude35)
  malformedPayload.body = {}
  t.nr.updatePayload(malformedPayload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, regionClaude35.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [])
  assert.equal(cmd.temperature, undefined)
})

test('claude35 skips a message that is null in `body.messages`', async (t) => {
  const malformedPayload = structuredClone(claude35)
  malformedPayload.body.messages = [{ role: 'user', content: 'who are you' }, null]
  t.nr.updatePayload(malformedPayload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: 'who are you' }])
})

test('region specific claude35 skips a message that is null in `body.messages`', async (t) => {
  const malformedPayload = structuredClone(regionClaude35)
  malformedPayload.body.messages = [{ role: 'user', content: 'who are you' }, null]
  t.nr.updatePayload(malformedPayload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: 'who are you' }])
})

test('claude35 handles defaulting prompt to empty array when `body.messages` is null', async (t) => {
  const malformedPayload = structuredClone(claude35)
  malformedPayload.body.messages = null
  t.nr.updatePayload(malformedPayload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.deepEqual(cmd.prompt, [])
})

test('region specific claude35 handles defaulting prompt to empty array when `body.messages` is null', async (t) => {
  const malformedPayload = structuredClone(regionClaude35)
  malformedPayload.body.messages = null
  t.nr.updatePayload(malformedPayload)
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.deepEqual(cmd.prompt, [])
})

test('claude35 minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(claude35))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, claude35.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: 'who are' }, { role: 'assistant', content: 'researching' }, { role: 'user', content: 'you' }])
  assert.equal(cmd.temperature, undefined)
})

test('region specific claude35 minimal command works', async (t) => {
  t.nr.updatePayload(structuredClone(regionClaude35))
  const cmd = new InvokeModelCommand(t.nr.input)
  assert.equal(cmd.isClaudeMessagesApi(), true)
  assert.equal(cmd.maxTokens, undefined)
  assert.equal(cmd.modelId, regionClaude35.modelId)
  assert.equal(cmd.modelType, 'completion')
  assert.deepEqual(cmd.prompt, [{ role: 'user', content: 'who are' }, { role: 'assistant', content: 'researching' }, { role: 'user', content: 'you' }])
  assert.equal(cmd.temperature, undefined)
})

test('claude35 complete command works', async (t) => {
  const payload = structuredClone(claude35)
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

test('region specific claude35 complete command works', async (t) => {
  const payload = structuredClone(regionClaude35)
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
